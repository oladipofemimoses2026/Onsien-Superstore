# ARCHITECTURE: Ọjà Pantry

## Overview
```
Browser (React + Vite + React Router, on Vercel)
  ├─ supabase-js (publishable key) ──► Supabase Auth (Google)
  ├─ supabase-js ──► read products / product_variants (RLS: public read)
  ├─ supabase-js ──► rpc('place_order')  (security definer, one transaction)
  ├─ supabase-js ──► read own orders / order_items (RLS: owner only)
  └─ fetch POST /api/send-confirmation (Bearer <user access token>)
                     └─ Vercel function: verify user → load order (secret key)
                        → check ownership → Mailgun → record result
```
No payments. Status is always `placed` (pay on delivery). Paystack is not part of this build.

## Approved dependencies
- `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`
- dev: `vite`, `@vitejs/plugin-react`

Mailgun is called with `fetch` (no SDK). Styling is plain CSS with custom properties. Anything else: ask first.

## Folder structure
```
/
├─ api/
│  └─ send-confirmation.js      # the only serverless function
├─ public/
├─ src/
│  ├─ main.jsx  App.jsx         # router + providers
│  ├─ lib/supabase.js           # createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
│  ├─ lib/money.js              # formatNaira(kobo), sumKobo(), deliveryKobo() (display estimates only)
│  ├─ context/AuthContext.jsx
│  ├─ context/CartContext.jsx
│  ├─ pages/ Home, Product, Cart, Checkout, OrderConfirmed, Privacy, NotFound (.jsx)
│  ├─ components/ Nav, Footer, ProductTile, OptionPicker, QuantityStepper, StatusBlock (.jsx)
│  └─ styles/ tokens.css, global.css
├─ supabase/
│  ├─ 001_schema.sql            # tables, sequence, RLS, policies, place_order
│  └─ 002_seed.sql              # catalogue from PRD.md
├─ index.html  vite.config.js  package.json  vercel.json
├─ .gitignore  .env.example  README.md
└─ AGENTS.md  CLAUDE.md  PRD.md  ARCHITECTURE.md  STYLE.md  TASTE.md
```

`vercel.json` (SPA routing, keep /api):
```json
{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }
```

## Data model
All money columns are `integer` kobo with `check (>= 0)`.

**products**
| column | type | notes |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| slug | text unique not null | |
| name | text not null | |
| description | text not null | one line |
| sort_order | int not null | 1–8 |
| active | boolean not null default true | |

**product_variants**
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| product_id | uuid fk → products on delete cascade | |
| label | text not null | "100g", "1L" |
| price_kobo | integer not null check (price_kobo > 0) | |
| stock | integer not null default 25 check (stock >= 0) | |
| sort_order | int not null | |

**orders**
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| order_number | text unique not null | `'OJA-' \|\| nextval('order_number_seq')`, seq starts 100001 |
| user_id | uuid not null fk → auth.users | = auth.uid() |
| status | text not null default 'placed' check (status = 'placed') | |
| customer_name, email, phone, address, city, state | text not null | email taken from auth.jwt() in the RPC |
| note | text | |
| subtotal_kobo, delivery_kobo, total_kobo | integer not null | set by the RPC only |
| email_sent_at | timestamptz | null until sent |
| email_error | text | last failure message |
| created_at | timestamptz not null default now() | |

**order_items**
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| order_id | uuid fk → orders on delete cascade | |
| variant_id | uuid fk → product_variants | |
| product_name, option_label | text not null | snapshot at order time |
| unit_price_kobo | integer not null | snapshot from DB |
| quantity | integer not null check (quantity between 1 and 10) | |
| line_total_kobo | integer not null | unit × quantity |

## RLS policies
- RLS **enabled** on all four tables.
- `products`, `product_variants`: `select` for `anon, authenticated` using `true`. No insert/update/delete policies.
- `orders`: `select` for `authenticated` using `user_id = auth.uid()`. No insert/update/delete policies.
- `order_items`: `select` for `authenticated` using `exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())`.
- Writes to orders happen only in `place_order` (security definer) and in the email function (secret key).

## `place_order` RPC
```sql
create function public.place_order(p_items jsonb, p_delivery jsonb)
returns table (order_id uuid, order_number text)
language plpgsql security definer set search_path = public
```
- `p_items`: `[{ "variant_id": "<uuid>", "quantity": 2 }, …]`. **No prices accepted.**
- `p_delivery`: `{ customer_name, phone, address, city, state, note }`.
- Steps, all in one transaction:
  1. `auth.uid()` must not be null, otherwise raise `not_signed_in`.
  2. Validate: 1–20 items, each quantity 1–10, no duplicate variant_ids, required delivery fields non-empty (trimmed, sensible max lengths).
  3. Lock the variants: `select … from product_variants v join products p … where v.id = any(…) for update`. Every variant must exist and its product must be active.
  4. If any `stock < quantity` → raise `out_of_stock:<product name> <label>`.
  5. Subtotal = Σ price_kobo × quantity. Delivery = 0 if subtotal ≥ 3000000 else 250000. Total = subtotal + delivery.
  6. Insert the order (email from `auth.jwt() ->> 'email'`), insert the items with snapshots, decrement stock.
  7. Return id and order_number.
- `revoke execute on function place_order from public, anon; grant execute … to authenticated;`
- Error messages use short codes the client maps to friendly text.

## Email function: `api/send-confirmation.js`
Node serverless function (Vercel default runtime, ESM).
1. Accept `POST` only. Body `{ order_id }`. Header `Authorization: Bearer <access_token>`.
2. Create an admin client with `VITE_SUPABASE_URL` + `SUPABASE_SECRET_KEY`. Verify the user with `admin.auth.getUser(token)` → 401 if invalid. (`SUPABASE_JWKS_URL` is available for local JWT verification but is not needed. Don't add a JWT library.)
3. Load the order and items with the admin client. 404 if missing. **403 if `order.user_id !== user.id`.**
4. If `email_sent_at` is already set → return `200 { status: "already_sent" }` (idempotent).
5. POST to `${MAILGUN_API_BASE}/v3/${MAILGUN_DOMAIN}/messages` with Basic auth `api:${MAILGUN_API_KEY}`, form fields `from=MAILGUN_FROM`, `to=order.email`, `subject="Your Ọjà Pantry order OJA-…"`, `text` and simple `html` (items, totals in naira, delivery address, link `${baseUrl}/order/<number>`), where `baseUrl = process.env.APP_URL || 'https://' + process.env.VERCEL_URL`. `APP_URL` is set for Production only; on Preview deployments, fall back to Vercel's automatic `VERCEL_URL`.
6. On success: `update orders set email_sent_at = now(), email_error = null`. On failure: `update orders set email_error = <short message>`. Return a JSON status. **Never throw away or alter the order.**
7. Never log keys or full tokens.

## Flows
- **Sign-in:** `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + returnPath } })`. AuthContext listens to `onAuthStateChange`. Sign-out clears the session (the cart stays).
- **Cart:** `CartContext` stores `[{ variant_id, product_slug, product_name, label, price_kobo, quantity }]` in `localStorage` key `oja_cart_v1`. Prices in the cart are **display estimates** refreshed from Supabase when the cart page loads.
- **Checkout:** form → `supabase.rpc('place_order', { p_items, p_delivery })` → on success clear the cart and navigate to `/order/:orderNumber` → call `/api/send-confirmation` with the session access token → show the email status. A failed fetch only changes the status message.
- **Order page:** reads the order by `order_number` through RLS (so other users get "not found").

## Environment variables
| Name | Where | Used for |
|---|---|---|
| `VITE_SUPABASE_URL` | browser + api | Supabase project URL (not secret) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | supabase-js public client |
| `VITE_CONTACT_EMAIL` | browser | footer and privacy page |
| `SUPABASE_SECRET_KEY` | api only | admin client in the email function |
| `SUPABASE_JWKS_URL` | api only | optional; unused in this build |
| `MAILGUN_API_KEY` | api only | Mailgun auth |
| `MAILGUN_DOMAIN` | api only | sandbox domain |
| `MAILGUN_API_BASE` | api only | e.g. `https://api.mailgun.net` (or the EU base) |
| `MAILGUN_FROM` | api only | sender, e.g. `Ọjà Pantry <postmaster@sandbox….mailgun.org>` |
| `APP_URL` | api only (**Production only**) | links in the email; on Preview, fall back to the automatic `VERCEL_URL` |
| `DATABASE_URL` | unused | not needed: SQL is run in the Supabase SQL Editor |

## Notes and gotchas
- **`VITE_` variables are baked in at build time.** Changing one in Vercel needs a **redeploy**.
- **Mailgun sandbox** only delivers to **authorized recipients** and often lands in **spam**. Test with your own authorized address.
- Supabase **Redirect URLs** must include the production URL, the preview URL pattern and `http://localhost:5173/**`, or Google sign-in will bounce to the wrong place.
- Variables are set for **Production + Preview**, not Development (the laptop uses `.env`). `APP_URL` is **Production only**.
- Secrets are stored as Vercel "Secret" type: they can't be viewed again after saving, only replaced.
- `/api` doesn't run under `npm run dev`. Test it on Vercel previews.

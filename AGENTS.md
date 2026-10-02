# AGENTS.md: Ọjà Pantry (HNG Internship 15, Task 2)

## The project
Ọjà Pantry is a small online shop selling Nigerian spices and condiments (8 products, 14 size options). It is a React + Vite + React Router site deployed on Vercel. Products and orders live in Supabase, with Row Level Security on. Customers sign in with Google through Supabase Auth, place an order (pay on delivery: **no payments in this build**), and receive a confirmation email sent by Mailgun from one Vercel serverless function.

- **Live URL:** `<PASTE VERCEL PRODUCTION URL HERE>`
- **Deadline:** submit by **11:00 PM WAT tonight (Friday 2 October 2026)**. The form closes at 11:59 PM. We aim for 10:50.

## Read these, in this order
1. `AGENTS.md`: this file (how we work, rules, milestones)
2. `PRD.md`: what to build (pages, business rules, catalogue, acceptance criteria)
3. `ARCHITECTURE.md`: how to build it (data model, RPC, email function, env vars)
4. `STYLE.md`: code conventions
5. `TASTE.md`: the design (Market Ledger). Follow it exactly.
6. `.env.example`: environment variable names

## How to work with me
- I'm a **beginner on Windows** using PowerShell. Give me copy-paste commands and tell me exactly where to click in the Supabase or Vercel dashboard.
- **Before each milestone**, give me a short plan (8 lines or fewer: files you'll touch, anything I must do by hand). **Wait for my OK.**
- **After each step**, explain what you did in plain language, in 2–5 sentences. No jargon without a one-line explanation.
- **Never hide failures.** If a build, test or deploy fails, show me the error and what you think it means. Don't say something works unless you ran it.
- **Time-box everything.** If a milestone is 10 minutes past its target, stop and tell me, then propose what to cut (see "Cut list").
- SQL is run by me: write it to files in `supabase/`, then tell me to paste it into **Supabase → SQL Editor → Run**.

## Non-negotiable rules
1. **Money is integer kobo.** Every price, fee and total is stored and computed as an `integer` number of kobo. No floats, no `numeric` with decimals, no `parseFloat`. Convert to naira only for display, using `src/lib/money.js`.
2. **The browser never decides prices or totals.** The cart may show estimates, but the order's prices, delivery fee and totals are calculated by the `place_order` Postgres function from the database.
3. **Nothing secret gets a `VITE_` prefix.** `SUPABASE_SECRET_KEY` and `MAILGUN_*` are only read inside `/api` functions.
4. **Never commit `.env`.** Create `.gitignore` **first**, before any other file, and check `.env` is listed.
5. **Row Level Security stays on** for every table. Anyone can read products. Users can read only their own orders and order items. No client-side inserts into orders: orders are created only through the RPC.
6. **An email failure must never lose or break an order.** The order is committed first; the email is sent afterwards; a failed email is recorded on the order and the customer still sees their confirmation page.
7. **Approved dependencies only** (listed in ARCHITECTURE.md). Ask me before adding anything else. No UI kits, no Tailwind, no state libraries.
8. **One branch per milestone** (`m0-skeleton`, `m1-catalogue`, `m2-cart-auth`, `m3-checkout`, `m4-polish`). Push the branch, I check the Vercel **preview** URL, and you merge to `main` only after I say OK.

## Commands (Windows PowerShell)
```powershell
# If PowerShell blocks npm scripts ("running scripts is disabled"), run once:
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

npm install            # install dependencies
npm run dev            # run locally at http://localhost:5173
npm run build          # production build (must pass before every push)
npm run preview        # serve the built site locally

# Branch workflow for each milestone
git checkout main
git pull
git checkout -b m1-catalogue
git add .
git commit -m "M1: catalogue pages"
git push -u origin m1-catalogue      # Vercel builds a preview URL

# After I've checked the preview:
git checkout main
git merge m1-catalogue
git push                             # deploys production
```
Note: `/api` functions don't run under `npm run dev`. Test the email function on the Vercel preview URL.

## Milestones (WAT, tonight)

### M0: Skeleton, database, seed (9:15–9:35)
- `.gitignore` (first), Vite React app, React Router with placeholder routes, `vercel.json` SPA rewrite, `src/lib/supabase.js`, `src/lib/money.js`, design tokens in `src/styles/tokens.css`.
- `supabase/001_schema.sql` (tables, RLS, policies, `place_order` function) and `supabase/002_seed.sql` (catalogue from PRD.md). I run both.
- **Done when:** `npm run build` passes; the production URL loads the placeholder home page; the Supabase Table Editor shows 8 products and 14 variants; RLS is shown as enabled on all 4 tables.

### M1: Catalogue (9:35–9:55)
- Home page (masthead + product index), product page with option picker, nav and footer, loading, empty and error states. Typographic tiles per TASTE.md.
- **Done when:** all 8 products show on the preview with correct naira prices read from Supabase; each product page loads by slug; option switching updates the price; there's no sideways scroll at 360px.

### M2: Cart and Google sign-in (9:55–10:15)
- Cart context saved in `localStorage`, add/update/remove, cart page with estimated subtotal. Google sign-in/out in the nav. Checkout route requires sign-in.
- I must add the Vercel production URL, preview URL pattern (`https://*-<team>.vercel.app/**`) and `http://localhost:5173/**` under **Supabase → Authentication → URL Configuration → Redirect URLs**.
- **Done when:** the cart survives a page refresh; quantity is capped 1–10; Google sign-in works on the preview URL and returns to the page you started from; signed-out users who open /checkout are asked to sign in.

### M3: Checkout, order and email (10:15–10:40)
- Checkout form → `place_order` RPC → confirmation page `/order/:orderNumber`. Then `api/send-confirmation.js` sends the Mailgun email and records the result.
- The email link uses `APP_URL`, falling back to `https://` + `VERCEL_URL` (APP_URL is Production-only).
- **Done when:** a real order on the preview creates 1 order + its items with DB-calculated totals; stock goes down; the confirmation page shows the order number; the email reaches my authorized Mailgun recipient (check spam); a forced email failure (e.g. a wrong domain in a test) still leaves the order saved, with `email_error` recorded.

### M4: Polish, privacy, README, submit (10:40–10:50)
- `/privacy` page, 404 page, a quality pass against TASTE.md's quality floor, `README.md` (what it is, stack, live URL, how to run, env var names, AI tools used).
- **Done when:** production URL works end-to-end on my phone; README is pushed; I've filled in the PRD submission checklist.

### Cut list (if behind, cut in this order)
1. Visual polish beyond the TASTE.md quality floor
2. The "My orders" link on the confirmation page
3. Product page long descriptions (keep one line)
Never cut: RLS, kobo money, the RPC, the email-failure safety.

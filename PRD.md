# PRD: Ọjà Pantry

## Task brief (HNG Internship 15, Task 2)
Build a website for a shop with a checkout page. Persist everything in Supabase. Send order confirmation emails with Mailgun. Set up Google sign-in through Google Cloud Console.

## Problem
Lagos home cooks who want good yaji, crayfish or egusi have to go to the market or trust random Instagram sellers with no clear prices. Ọjà Pantry is a small, trustworthy online shop with fixed prices, simple sizes and a clear order confirmation.

## Users
- **Home cooks** (20–35, Lagos) restocking pantry staples.
- **Gift buyers** putting together a food parcel for family or friends abroad-bound.

## Goals
1. A customer can browse, pick a size, add to cart, sign in with Google and place an order in under 2 minutes on a phone.
2. Every order is saved in Supabase with server-calculated totals.
3. Every order triggers a confirmation email.

## Out of scope
Online payments (Paystack), admin panel, order editing or cancelling, refunds, reviews and ratings, search and filters, coupons, wishlists, multiple addresses, inventory management UI, email/password sign-in, real product photos.

## Pages and requirements

### Home `/`
- R1. Masthead with shop name, one-line pitch and a link down to the product index.
- R2. Product index listing all active products (tile, name, "from" price, options count) sorted by `sort_order`.
- R3. Loading, empty ("The shelves are being restocked") and error states.

### Product `/product/:slug`
- R4. Typographic tile, name, one-line description, option picker (radio group), price for the selected option, stock state.
- R5. Quantity stepper 1–10. "Add to cart" disabled when the selected option is sold out.
- R6. Unknown slug shows the 404 state.

### Cart `/cart`
- R7. Lines show product, option, unit price, quantity stepper, line total, remove.
- R8. Estimated subtotal, delivery fee and total, labelled "estimated: confirmed at checkout".
- R9. Empty cart state links back to the shop. Cart persists in `localStorage`.

### Checkout `/checkout` (signed-in only)
- R10. Signed-out visitors see "Sign in with Google to check out" and return here afterwards.
- R11. Form: full name (prefilled from Google), phone, delivery address, city, state (dropdown of 36 states + FCT), optional delivery note. Email comes from the Google account (shown, not editable).
- R12. Order summary. "Place order" button calls `place_order`, is disabled while submitting, and prevents double submits.
- R13. Errors (sold out, quantity changed, network) are shown in plain language without losing the form.

### Order confirmed `/order/:orderNumber` (owner only)
- R14. Order number, items, totals from the database, delivery details, "Pay on delivery" note, and email status ("Confirmation sent to …" / "We couldn't send the email, but your order is saved").
- R15. Cart is cleared after a successful order.

### Privacy `/privacy`
- R16. Plain-language page: what we store (name, email, phone, address, orders), why, Google sign-in, Mailgun email, contact `VITE_CONTACT_EMAIL`.

### Global
- R17. Nav: wordmark, Shop, Cart (count), Sign in / account menu with Sign out. Footer: privacy link, contact email, HNG credit.
- R18. 404 page for unknown routes.

## Business rules
- **Currency:** naira, stored as integer kobo (₦1 = 100 kobo). Displayed as `₦4,500`.
- **Delivery fee:** ₦2,500 flat (250000 kobo) nationwide. **Free when the subtotal is ₦30,000 or more** (3000000 kobo). Calculated in the database.
- **Quantity:** 1–10 per line; a cart line is a product option (variant). At most 20 lines per order.
- **Stock:** each variant is seeded with 25. The order fails with a clear message if any line exceeds stock. Stock goes down in the same transaction that creates the order.
- **Order number:** `OJA-` + a number from a database sequence starting at 100001 (e.g. `OJA-100001`).
- **Order status:** `placed` (pay on delivery). No other statuses in this build.
- **Sign-in:** Google only. Orders are tied to `auth.uid()`.

## Catalogue (seed data)
| # | Product (slug) | Description | Option | Price (₦) | Price (kobo) |
|---|---|---|---|---|---|
| 01 | Yaji Suya Spice (`yaji-suya-spice`) | Kano-style suya pepper: groundnut, ginger, cayenne. | 100g | 2,500 | 250000 |
| | | | 250g | 5,000 | 500000 |
| 02 | Ata Dindin Pepper Sauce (`ata-dindin`) | Slow-fried tatashe and scotch bonnet in oil. | 250ml | 3,500 | 350000 |
| | | | 500ml | 6,000 | 600000 |
| 03 | Zobo Mix (`zobo-mix`) | Dried hibiscus with ginger, clove and pineapple peel. | 200g | 2,000 | 200000 |
| | | | 500g | 4,500 | 450000 |
| 04 | Crayfish Powder (`crayfish-powder`) | Sun-dried crayfish, finely ground, no sand. | 200g | 4,000 | 400000 |
| | | | 500g | 9,000 | 900000 |
| 05 | Ground Egusi (`ground-egusi`) | Cleaned, milled melon seed for soup. | 500g | 5,500 | 550000 |
| | | | 1kg | 10,000 | 1000000 |
| 06 | Ofada Stew Base (`ofada-stew-base`) | Green pepper and locust bean base. Just add protein. | 500ml | 7,500 | 750000 |
| 07 | Ehuru (`ehuru`) | Whole calabash nutmeg for pepper soup and ofe nsala. | 50g | 3,000 | 300000 |
| 08 | Red Palm Oil (`red-palm-oil`) | Unbleached oil from a single Imo farm. | 1L | 4,500 | 450000 |
| | | | 2L | 8,500 | 850000 |

## Acceptance criteria
- AC1. All 8 products and 14 options load from Supabase on the live URL.
- AC2. A signed-in user can place an order. `orders` and `order_items` rows exist with totals equal to DB prices × quantities + delivery rule.
- AC3. Changing a price in the browser (devtools) cannot change the stored order total.
- AC4. User A cannot read user B's order (tested by opening B's order URL while signed in as A → not found).
- AC5. A confirmation email arrives at an authorized Mailgun recipient within 1 minute (may be in spam).
- AC6. If Mailgun fails, the order still exists and `email_error` is set.
- AC7. `.env` is not in the GitHub repo. No secret appears in the built JS (search the deployed bundle for the Mailgun key prefix).
- AC8. Works at 360px wide with no sideways scroll; keyboard-only checkout is possible.

## Submission checklist (HNG form)
- [ ] Live link: `<production URL>`
- [ ] Supabase used: Yes
- [ ] Mailgun used: Yes (sandbox domain, authorized recipients)
- [ ] AI models used: Claude (planning in claude.ai), Claude Code (`<model shown in Claude Code>`)
- [ ] IDE: `<e.g. VS Code>`
- [ ] Prompt count: `<count>`
- [ ] Hardest part: `<one or two honest sentences, e.g. getting Google OAuth redirects working on Vercel previews>`
- [ ] GitHub repo link (if asked): `<repo URL>`

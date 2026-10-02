# TASTE: Market Ledger

## The idea
A premium grocer's catalogue printed on cream paper: each product is an entry in a well-kept ledger with numbered rows, fine ink rules, and prices set in typewriter mono. It feels calm and confident, with plenty of space. The only loud thing is a single stroke of pepper red.

## Palette (CSS custom properties in `tokens.css`)
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F4EEE3` | Page background |
| `--paper-deep` | `#EAE1D0` | Product tiles, cart summary panel, input background |
| `--ink` | `#1A1714` | Body text, headings, hairline rules, primary button background |
| `--ink-soft` | `#5C544B` | Secondary text, labels, meta |
| `--pepper` | `#B8321E` | One accent per screen: active option, cart count, sale/sold-out tag, link underlines on hover, focus ring |
| `--paper-on-ink` | `#F4EEE3` | Text on ink or pepper backgrounds |
| `--leaf` | `#3E5A3A` | Success messages only (email sent, order placed) |

Contrast: ink on paper, ink-soft on paper, paper on ink, paper on pepper, and pepper on paper all pass WCAG AA for normal text. Don't put pepper text on paper-deep below 18px.

## Fonts (Google Fonts)
- **Fraunces** (variable; weights 400, 600; use `opsz` automatic) for headings, product names and body text.
- **IBM Plex Mono** (400, 500) for prices, weights, order numbers, labels, buttons, and nav.

| Role | Font | Size phone / desktop | Weight | Notes |
|---|---|---|---|---|
| Masthead (h1 on home) | Fraunces | 44px / 96px | 600 | line-height 0.95, letter-spacing -0.02em |
| Page title (h1) | Fraunces | 34px / 56px | 600 | line-height 1.05 |
| Product name in tile | Fraunces | 28px / 36px | 400 | |
| Section heading (h2) | Fraunces | 24px / 30px | 600 | |
| Body | Fraunces | 17px / 18px | 400 | line-height 1.55, max 62ch |
| Label / nav / button | IBM Plex Mono | 13px / 13px | 500 | UPPERCASE, letter-spacing 0.08em |
| Price | IBM Plex Mono | 16px / 18px | 500 | tabular numbers |
| Ledger number ("No. 03") | IBM Plex Mono | 12px | 400 | `--ink-soft` |

Fallbacks: `Fraunces, Georgia, 'Times New Roman', serif`; `'IBM Plex Mono', Consolas, 'Courier New', monospace`.

## Layout
- Page max width 1200px, side padding 20px (phone) / 40px (desktop).
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 72, 112px. Section gaps are generous: 72px on phone, 112px on desktop.
- 1px `--ink` hairline rules separate sections and ledger rows, instead of shadows or boxes.
- **Phone:** single column. Product index is one tile per row.
- **Tablet (≥768px):** 2-column product grid.
- **Desktop (≥1100px):** masthead set left over 8 of 12 columns, with a short intro in mono at the right. Product grid has 3 columns with 1px rules between tiles (a grid of cells, like a ledger page), not floating cards.
- Align things to a strong left edge. Left-aligned text everywhere except prices, which are right-aligned in rows.

## Components
- **Nav:** a thin top bar on `--paper` with a bottom hairline. Left: wordmark "Ọjà Pantry" in Fraunces 600, 22px. Right: SHOP · CART (2) · SIGN IN in mono labels. The cart count is in pepper. Sticky on desktop and static on phone, 56px tall.
- **Product tile (typographic placeholder):** a square block. The background rotates by index: `--paper-deep`, `--ink` (with paper text), `--paper-deep`, `--pepper` (with paper text). Top-left: "No. 01" in mono. Bottom-left: product name in Fraunces. Bottom-right: the smallest weight ("100g") in mono. Below the tile: name (Fraunces 20px), "from ₦2,500" (mono), and "2 sizes" (mono, ink-soft). The whole tile is one link. On hover, the name underline appears in pepper. No shadows, no rounded corners.
- **Product page:** phone: tile, then details. Desktop: two columns (tile on the left, 6 cols; details on the right, 5 cols). The details are: ledger number, name (h1), one-line description, a hairline, the option picker as mono "chips" (rectangular, 1px ink border, 44px tall; the selected chip is ink-filled with paper text; a sold-out chip is struck through and disabled), the price large in mono, the quantity stepper, and the Add to cart button at full width on phone. A small mono line underneath: "Pay on delivery · Delivered in Lagos in 2–3 days".
- **Cart:** a ledger table. Each row shows the product name and option, the unit price, the stepper, the line total (right-aligned) and a "Remove" text button, with hairlines between rows. On phone, each row stacks into two lines. The summary panel on `--paper-deep` shows subtotal, delivery and total, labelled "Estimated: confirmed at checkout". Free delivery hint: "₦X more for free delivery."
- **Checkout:** phone: the form first, then the summary. Desktop: form 7 cols, sticky summary 5 cols. A "Signed in as ada@gmail.com" line in mono sits at the top.
- **Order confirmed:** big Fraunces line "Order OJA-100001 is in.", then the items ledger, totals, delivery block, and the email status line in leaf or ink-soft.
- **Buttons:**
  - Primary: `--ink` background, `--paper-on-ink` mono uppercase label, 48px tall, square corners. Hover: `--pepper` background.
  - Secondary: transparent with a 1px ink border.
  - Text buttons: mono, underlined.
  - Disabled: 40% opacity plus the `not-allowed` cursor.
- **Forms:** the label sits above each field in mono uppercase 12px. Inputs have a `--paper-deep` background, a 1px `--ink` bottom border only, 48px tall, and 17px Fraunces text. Focus: 2px pepper outline with a 2px offset. Errors appear in pepper text under the field, starting with "↳".
- **Status blocks (loading, empty, error):** an italic Fraunces line plus a mono action. For example: *Fetching the shelves…*

## Copy and tone
Warm, short and a little proud, like a good market seller. Use naira everywhere. Avoid exclamation marks except in the confirmation.
- Home masthead: **"Pantry staples, properly made."** with the subline "Yaji, crayfish, egusi and more, from small Nigerian producers. Pay on delivery."
- Empty cart: *"Your basket is empty."* followed by "Browse the shelves →"
- Sign-in prompt: "Sign in with Google to check out. It keeps your orders together."
- Out of stock: "Sold out for now"
- Error: "Something went wrong on our side. Your cart is safe. Try again."
- Order placed: "Order OJA-100001 is in! We'll call before delivery."
- Email failed: "We couldn't send the confirmation email, but your order is saved."

## Avoid
Purple or any gradients · drop shadows · rounded cards · pill buttons · emoji in the UI · stock-photo vibes · centred everything · more than one pepper accent per screen · icon libraries · carousels or sliders · modal popups · placeholder "Lorem ipsum" · all-caps Fraunces.

## Quality floor (must pass before M4 is done)
- No horizontal scroll at **360px** wide on any page.
- Everything is usable by **keyboard** alone, with a visible focus ring, through to checkout.
- **WCAG AA contrast** for all text.
- **Tap targets of at least 44×44px** (chips, stepper buttons, remove buttons, nav links).
- Fonts load with `display=swap`, and the layout doesn't jump when they arrive.
- Every page has a sensible `<title>` ("Yaji Suya Spice · Ọjà Pantry").

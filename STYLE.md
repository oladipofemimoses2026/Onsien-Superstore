# STYLE: code conventions

## General
- Plain JavaScript (JSX), ES modules, function components and hooks. No TypeScript tonight.
- Small, readable functions: under ~40 lines, with one job each. Name things for what they mean (`placeOrder`, `formatNaira`), not how they work.
- One component per file, named in PascalCase. Helpers in camelCase.
- Comments explain *why*, not what. Short.
- No dead code, no `console.log` left in commits (use `console.error` for real errors).

## Money
- Every amount is an integer of kobo. Variable names end in `Kobo` (`priceKobo`, `totalKobo`).
- `src/lib/money.js` is the only place that converts:
  ```js
  export const formatNaira = (kobo) =>
    '₦' + Math.round(kobo / 100).toLocaleString('en-NG');
  ```
- Browser totals are labelled as estimates. Stored totals come from the database.

## Data and state
- All Supabase calls go through small functions in the page or in `src/lib/` (e.g. `fetchProducts()`), returning `{ data, error }`.
- Handle `error` every time. Show a friendly message and log details with `console.error`.

## Every data page has four states
1. **Loading:** a quiet text line ("Fetching the shelves…"), not a spinner wall.
2. **Empty:** helpful copy plus a way forward.
3. **Error:** plain-language message plus a "Try again" button.
4. **Success.**

## Accessibility
- Use real elements: `<button>` for actions, `<a>`/`<Link>` for navigation, `<label for>` on every input, a radio group (`fieldset` + `legend`) for options.
- Visible focus styles (never `outline: none` without a replacement).
- Form errors are shown in text next to the field and linked with `aria-describedby`. The submit error area uses `role="alert"`.
- Buttons announce state: `disabled` + "Placing order…" while submitting.
- Images and decorative tiles: tiles are text, so they're readable. Purely decorative elements get `aria-hidden="true"`.
- One `<h1>` per page. Headings in order.

## CSS
- Mobile first: base styles for 360px, then `@media (min-width: 768px)` and `(min-width: 1100px)`.
- Use only the tokens in `tokens.css` (colours, fonts, spacing). No new hex values in components.
- Plain class names (`.product-tile`, `.cart-line`). No CSS frameworks.

## Git
- Create `.gitignore` before anything else. It must include `node_modules`, `dist`, `.env`, `.env.*` (but not `.env.example`), `.vercel`.
- One branch per milestone: `m0-skeleton`, `m1-catalogue`, `m2-cart-auth`, `m3-checkout`, `m4-polish`.
- Commit messages: `M1: add product page option picker` (milestone prefix, imperative, under 72 characters).
- `npm run build` must pass before every push.
- Merge to `main` only after the user has checked the Vercel preview.

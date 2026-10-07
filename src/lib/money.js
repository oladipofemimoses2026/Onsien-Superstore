// Prices are stored in kobo (₦1 = 100 kobo). These helpers turn them into Naira for display.

export function formatNaira(kobo) {
  return '₦' + (Number(kobo || 0) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

// Same delivery rule as the database's place_order function:
// free delivery from ₦30,000, otherwise ₦2,500.
export const FREE_DELIVERY_FROM_KOBO = 3000000;
export const DELIVERY_FEE_KOBO = 250000;

export function deliveryFor(subtotalKobo) {
  return subtotalKobo >= FREE_DELIVERY_FROM_KOBO ? 0 : DELIVERY_FEE_KOBO;
}

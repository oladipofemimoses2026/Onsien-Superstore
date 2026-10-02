// The only place kobo is converted. Totals here are display estimates;
// the database calculates the real ones in place_order.
export const FREE_DELIVERY_KOBO = 3000000;
export const DELIVERY_FEE_KOBO = 250000;

export const formatNaira = (kobo) =>
  '₦' + Math.round(kobo / 100).toLocaleString('en-NG');

export const sumKobo = (amountsKobo) =>
  amountsKobo.reduce((total, kobo) => total + kobo, 0);

export const deliveryKobo = (subtotalKobo) =>
  subtotalKobo >= FREE_DELIVERY_KOBO ? 0 : DELIVERY_FEE_KOBO;

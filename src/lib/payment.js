// Asks our server to start a Paystack payment, then sends the customer to Paystack's page.
import { supabase } from './supabase.js';

export const PENDING_ORDER_KEY = 'oja-pending-order';

export async function startPayment(orderId) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');

  const res = await fetch('/api/start-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.authorization_url) {
    throw new Error(json.error || 'Could not start payment.');
  }

  // Remember the order, so the customer can retry if they cancel on Paystack's page.
  try {
    localStorage.setItem(PENDING_ORDER_KEY, orderId);
  } catch {
    // Not critical.
  }

  window.location.href = json.authorization_url;
}

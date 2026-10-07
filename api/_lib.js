// Shared helpers for the /api server functions.
// The underscore at the start of the file name tells Vercel this is not a page of its own.
import { createClient } from '@supabase/supabase-js';

let adminClient = null;

// A Supabase client that uses the SECRET key. Only ever used on the server.
export function getAdmin() {
  if (!adminClient) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY on the server');
    }
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

// Works out which signed-in user sent the request, using the token the browser sends.
export async function getUserFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await getAdmin().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Talks to Paystack using the SECRET key.
export async function paystack(path, options = {}) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error('Missing PAYSTACK_SECRET_KEY on the server');
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.status) {
    throw new Error(json.message || `Paystack error ${res.status}`);
  }
  return json.data;
}

// Turns kobo into a Naira string, e.g. 250000 -> ₦2,500
export function naira(kobo) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Sends the order confirmation email through Mailgun.
export async function sendOrderEmail(order, items) {
  const domain = process.env.MAILGUN_DOMAIN;
  const key = process.env.MAILGUN_API_KEY;
  if (!domain || !key) throw new Error('Missing MAILGUN_DOMAIN or MAILGUN_API_KEY on the server');

  const base = process.env.MAILGUN_API_BASE || 'https://api.mailgun.net';
  const from = process.env.MAILGUN_FROM || `Oja Pantry <postmaster@${domain}>`;

  const textLines = items.map(
    (i) => `${i.quantity} x ${i.product_name} (${i.option_label}) - ${naira(i.line_total_kobo)}`
  );

  const text = [
    `Hi ${order.customer_name},`,
    '',
    `Thank you for your order! Your payment was received.`,
    `Order number: ${order.order_number}`,
    '',
    ...textLines,
    '',
    `Subtotal: ${naira(order.subtotal_kobo)}`,
    `Delivery: ${order.delivery_kobo === 0 ? 'Free' : naira(order.delivery_kobo)}`,
    `Total paid: ${naira(order.total_kobo)}`,
    '',
    `Delivering to: ${order.address}, ${order.city}, ${order.state}`,
    `Phone: ${order.phone}`,
    '',
    'Ọjà Pantry',
  ].join('\n');

  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:6px 0">${i.quantity} × ${escapeHtml(i.product_name)} <span style="color:#777">(${escapeHtml(i.option_label)})</span></td>
        <td style="padding:6px 0;text-align:right">${naira(i.line_total_kobo)}</td>
      </tr>`
    )
    .join('');

  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222">
    <h2 style="color:#2f5d34">Thank you for your order!</h2>
    <p>Hi ${escapeHtml(order.customer_name)}, your payment was received and your order is confirmed.</p>
    <p><strong>Order number:</strong> ${escapeHtml(order.order_number)}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #ddd;border-bottom:1px solid #ddd">${rows}</table>
    <p style="text-align:right">
      Subtotal: ${naira(order.subtotal_kobo)}<br>
      Delivery: ${order.delivery_kobo === 0 ? 'Free' : naira(order.delivery_kobo)}<br>
      <strong>Total paid: ${naira(order.total_kobo)}</strong>
    </p>
    <p><strong>Delivering to:</strong><br>${escapeHtml(order.address)}, ${escapeHtml(order.city)}, ${escapeHtml(order.state)}<br>Phone: ${escapeHtml(order.phone)}</p>
    <p style="color:#777">Ọjà Pantry</p>
  </div>`;

  const body = new URLSearchParams({
    from,
    to: order.email,
    subject: `Your Ọjà Pantry order ${order.order_number}`,
    text,
    html,
  });

  const res = await fetch(`${base}/v3/${domain}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`api:${key}`).toString('base64') },
    body,
  });
  if (!res.ok) {
    throw new Error(`Mailgun ${res.status}: ${await res.text()}`);
  }
}

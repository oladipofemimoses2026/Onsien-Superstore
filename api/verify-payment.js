// POST /api/start-payment
// Body: { order_id }
// Creates a Paystack payment for the order's real total (taken from the database, never the browser).
import { getAdmin, getUserFromRequest, paystack } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Please sign in again.' });
    }

    const orderId = req.body?.order_id;
    if (!orderId) {
      return res.status(400).json({ error: 'Missing order_id' });
    }

    const { data: order, error } = await getAdmin()
      .from('orders')
      .select('id, order_number, user_id, email, total_kobo, status')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;

    // Only the person who placed the order can pay for it.
    if (!order || order.user_id !== user.id) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.status === 'paid') {
      return res.status(409).json({ error: 'This order has already been paid.' });
    }

    // Work out the site's own address, so Paystack can send the customer back here after paying.
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const appUrl = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '');

    const reference = `${order.order_number}-${Date.now()}`;

    const data = await paystack('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: order.email,
        amount: order.total_kobo, // Paystack expects kobo, which is what we store
        currency: 'NGN',
        reference,
        callback_url: `${appUrl}/payment/callback`,
        metadata: { order_id: order.id, order_number: order.order_number },
      }),
    });

    return res.status(200).json({
      authorization_url: data.authorization_url,
      reference: data.reference,
    });
  } catch (err) {
    console.error('start-payment failed:', err);
    return res.status(500).json({ error: 'Could not start payment. Please try again.' });
  }
}

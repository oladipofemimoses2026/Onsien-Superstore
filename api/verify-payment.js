// POST /api/verify-payment
// Body: { reference }
// Confirms the payment with Paystack, marks the order paid, and sends the Mailgun email once.
import { getAdmin, paystack, sendOrderEmail } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const reference = req.body?.reference;
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ error: 'Missing payment reference.' });
    }

    // 1. Ask Paystack directly what happened. Never trust the browser on this.
    const tx = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (tx.status !== 'success') {
      return res.status(402).json({ error: 'Payment was not completed. Paystack status: ' + tx.status });
    }

    let meta = tx.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = {}; }
    }
    const orderId = meta?.order_id;
    if (!orderId) {
      return res.status(400).json({ error: 'This payment is not linked to an order.' });
    }

    const admin = getAdmin();
    const { data: order, error } = await admin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // 2. The amount paid must match the order total exactly.
    if (tx.amount !== order.total_kobo || tx.currency !== 'NGN') {
      console.error('Amount mismatch', { reference, paid: tx.amount, expected: order.total_kobo, currency: tx.currency });
      return res.status(400).json({
        error: `Payment amount does not match the order total (paid ${tx.amount} ${tx.currency}, expected ${order.total_kobo} NGN).`,
      });
    }

    // 3. Mark it paid. The "status = placed" condition means only ONE request can ever do this.
    let justPaid = false;
    if (order.status !== 'paid') {
      const { data: updated, error: updateError } = await admin
        .from('orders')
        .update({ status: 'paid', paystack_reference: reference, paid_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('status', 'placed')
        .select('id');
      if (updateError) throw updateError;
      justPaid = updated.length > 0;
    }

    // 4. Send the email only from the request that marked it paid, so it's never sent twice.
    let emailSent = Boolean(order.email_sent_at);
    if (justPaid) {
      const { data: items, error: itemsError } = await admin
        .from('order_items')
        .select('product_name, option_label, quantity, line_total_kobo')
        .eq('order_id', order.id);
      if (itemsError) throw itemsError;

      try {
        await sendOrderEmail(order, items);
        await admin
          .from('orders')
          .update({ email_sent_at: new Date().toISOString(), email_error: null })
          .eq('id', order.id);
        emailSent = true;
      } catch (mailError) {
        // The payment still counts. We just record why the email failed so it can be checked.
        console.error('Order email failed:', mailError);
        await admin
          .from('orders')
          .update({ email_error: String(mailError.message || mailError).slice(0, 500) })
          .eq('id', order.id);
      }
    }

    return res.status(200).json({
      order_number: order.order_number,
      total_kobo: order.total_kobo,
      email: order.email,
      email_sent: emailSent,
    });
  } catch (err) {
    console.error('verify-payment failed:', err);
    // Temporary: show the real reason so we can fix it.
    return res.status(500).json({
      error: 'Could not confirm the payment: ' + (err?.message || String(err)),
    });
  }
}

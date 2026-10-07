// Checkout: sign in, enter delivery details, place the order, then pay with Paystack.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { formatNaira, deliveryFor } from '../lib/money.js';
import { startPayment } from '../lib/payment.js';

const STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara',
];

// Turns the database's short error codes into friendly messages.
function friendlyError(message = '') {
  if (message.includes('not_signed_in')) return 'Please sign in again to place your order.';
  if (message.includes('no_email')) return 'Your Google account has no email address we can use.';
  if (message.includes('invalid_delivery')) return 'Please check your delivery details.';
  if (message.includes('duplicate_items') || message.includes('invalid_items')) {
    return 'Something is wrong with your cart. Please remove the items and add them again.';
  }
  if (message.includes('unavailable_item')) return 'An item in your cart is no longer available. Please remove it.';
  if (message.includes('out_of_stock:')) {
    const name = message.split('out_of_stock:')[1]?.trim();
    return `Sorry, we don't have enough ${name || 'of an item'} in stock. Please lower the quantity.`;
  }
  return 'Something went wrong placing your order. Please try again.';
}

export default function Checkout() {
  const { user, loading, signInWithGoogle } = useAuth();
  const { items, subtotal, clear } = useCart();

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    city: '',
    state: 'Lagos',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null); // { order_id, order_number }

  // Fill in the name from Google the first time, if the customer hasn't typed one.
  const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const nameValue = form.customer_name || (form.customer_name === '' && !form._touchedName ? googleName : '');

  function update(field) {
    return (e) =>
      setForm((f) => ({
        ...f,
        [field]: e.target.value,
        ...(field === 'customer_name' ? { _touchedName: true } : {}),
      }));
  }

  async function retryPayment() {
    setError('');
    setSubmitting(true);
    try {
      await startPayment(placedOrder.order_id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    // 1. Create the order. The database works out the real prices and total.
    const { data, error: orderError } = await supabase.rpc('place_order', {
      p_items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      p_delivery: {
        customer_name: nameValue.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state,
        note: form.note.trim(),
      },
    });

    if (orderError) {
      console.error(orderError);
      setError(friendlyError(orderError.message));
      setSubmitting(false);
      return;
    }

    const order = Array.isArray(data) ? data[0] : data;
    setPlacedOrder(order);

    // 2. The order now exists, so empty the cart to avoid placing it twice.
    clear();

    // 3. Go to Paystack.
    try {
      await startPayment(order.order_id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  // The order was placed but getting to Paystack failed: offer a retry for the SAME order.
  if (placedOrder && !submitting) {
    return (
      <div className="page narrow center">
        <h1>Order {placedOrder.order_number} placed</h1>
        <p className="muted">We couldn't open the payment page. Your order is saved, so you can try paying again.</p>
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn btn-primary" onClick={retryPayment}>
          Try payment again
        </button>
      </div>
    );
  }

  if (placedOrder && submitting) {
    return <p className="page muted center">Taking you to Paystack…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="page narrow center">
        <h1>Nothing to check out</h1>
        <p className="muted">Your cart is empty.</p>
        <Link to="/" className="btn btn-primary">Browse products</Link>
      </div>
    );
  }

  if (loading) return <p className="page muted center">Loading…</p>;

  if (!user) {
    return (
      <div className="page narrow center">
        <h1>Sign in to check out</h1>
        <p className="muted">We use your Google account to keep your orders safe and email your receipt.</p>
        <button type="button" className="btn btn-primary" onClick={() => signInWithGoogle('/checkout')}>
          Sign in with Google
        </button>
      </div>
    );
  }

  const delivery = deliveryFor(subtotal);
  const total = subtotal + delivery;

  return (
    <div className="page checkout-layout">
      <form className="checkout-form" onSubmit={handleSubmit}>
        <h1>Delivery details</h1>
        <p className="small muted">Signed in as {user.email}. Your receipt will be sent here.</p>

        <label>
          Full name
          <input value={nameValue} onChange={update('customer_name')} required maxLength={100} autoComplete="name" />
        </label>

        <label>
          Phone number
          <input type="tel" value={form.phone} onChange={update('phone')} required maxLength={30} placeholder="080..." autoComplete="tel" />
        </label>

        <label>
          Delivery address
          <textarea value={form.address} onChange={update('address')} required maxLength={300} rows={3} autoComplete="street-address" />
        </label>

        <div className="form-row">
          <label>
            City
            <input value={form.city} onChange={update('city')} required maxLength={100} autoComplete="address-level2" />
          </label>

          <label>
            State
            <select value={form.state} onChange={update('state')} required>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Note for delivery (optional)
          <textarea value={form.note} onChange={update('note')} maxLength={500} rows={2} />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Placing order…' : `Place order & pay ${formatNaira(total)}`}
        </button>
        <p className="small muted center">You'll pay securely on Paystack's page.</p>
      </form>

      <aside className="summary">
        <h2>Order summary</h2>
        {items.map((i) => (
          <div key={i.variant_id} className="summary-row">
            <span>{i.quantity} × {i.product_name} ({i.label})</span>
            <span>{formatNaira(i.price_kobo * i.quantity)}</span>
          </div>
        ))}
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatNaira(subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>Delivery</span>
          <span>{delivery === 0 ? 'Free' : formatNaira(delivery)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatNaira(total)}</span>
        </div>
      </aside>
    </div>
  );
}

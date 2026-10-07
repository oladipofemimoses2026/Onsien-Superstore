// The cart page: review items, change quantities, see the total, go to checkout.
import { Link } from 'react-router-dom';
import { useCart, MAX_QTY } from '../lib/cart.jsx';
import { formatNaira, deliveryFor, FREE_DELIVERY_FROM_KOBO } from '../lib/money.js';

export default function Cart() {
  const { items, setQuantity, remove, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="page narrow center">
        <h1>Your cart is empty</h1>
        <p className="muted">Have a look around the pantry and add something tasty.</p>
        <Link to="/" className="btn btn-primary">Browse products</Link>
      </div>
    );
  }

  const delivery = deliveryFor(subtotal);
  const total = subtotal + delivery;
  const toFreeDelivery = FREE_DELIVERY_FROM_KOBO - subtotal;

  return (
    <div className="page narrow">
      <h1>Your cart</h1>

      <ul className="cart-list">
        {items.map((item) => (
          <li key={item.variant_id} className="cart-item">
            <div className="cart-item-info">
              <strong>{item.product_name}</strong>
              <span className="muted"> · {item.label}</span>
              <div className="small muted">{formatNaira(item.price_kobo)} each</div>
            </div>

            <div className="qty-controls">
              <button
                type="button"
                className="qty-btn"
                aria-label="Decrease quantity"
                onClick={() => setQuantity(item.variant_id, item.quantity - 1)}
                disabled={item.quantity <= 1}
              >
                −
              </button>
              <span className="qty">{item.quantity}</span>
              <button
                type="button"
                className="qty-btn"
                aria-label="Increase quantity"
                onClick={() => setQuantity(item.variant_id, item.quantity + 1)}
                disabled={item.quantity >= MAX_QTY}
              >
                +
              </button>
            </div>

            <div className="cart-item-total">{formatNaira(item.price_kobo * item.quantity)}</div>

            <button type="button" className="link-btn" onClick={() => remove(item.variant_id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatNaira(subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>Delivery</span>
          <span>{delivery === 0 ? 'Free' : formatNaira(delivery)}</span>
        </div>
        {toFreeDelivery > 0 && (
          <p className="small muted">Add {formatNaira(toFreeDelivery)} more for free delivery.</p>
        )}
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatNaira(total)}</span>
        </div>
      </div>

      <div className="actions">
        <Link to="/" className="btn">Continue shopping</Link>
        <Link to="/checkout" className="btn btn-primary">Proceed to checkout</Link>
      </div>
    </div>
  );
}

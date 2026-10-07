// The frame around every page: top bar, the page itself, and footer.
import { Routes, Route, Link, NavLink } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { useCart } from './lib/cart.jsx';
import Shop from './pages/Shop.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import PaymentCallback from './pages/PaymentCallback.jsx';

export default function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Shop />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>© Ọjà Pantry · Test mode: payments use Paystack test cards, no real money is charged.</p>
      </footer>
    </div>
  );
}

function Header() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { count } = useCart();

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">Ọjà Pantry</Link>

        <nav className="nav">
          <NavLink to="/" end>Shop</NavLink>
          <NavLink to="/cart">
            Cart{count > 0 && <span className="badge">{count}</span>}
          </NavLink>

          {!loading &&
            (user ? (
              <button type="button" className="link-btn" onClick={signOut} title={user.email}>
                Sign out
              </button>
            ) : (
              <button type="button" className="btn btn-small" onClick={() => signInWithGoogle()}>
                Sign in
              </button>
            ))}
        </nav>
      </div>
    </header>
  );
}

function NotFound() {
  return (
    <div className="page narrow center">
      <h1>Page not found</h1>
      <p className="muted">That page doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Back to shop</Link>
    </div>
  );
}

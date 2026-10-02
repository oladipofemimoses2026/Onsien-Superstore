import { Routes, Route } from 'react-router-dom';
import Placeholder from './pages/Placeholder.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="Ọjà Pantry" note="Pantry staples, properly made. Opening soon." />} />
      <Route path="/product/:slug" element={<Placeholder title="Product" />} />
      <Route path="/cart" element={<Placeholder title="Cart" />} />
      <Route path="/checkout" element={<Placeholder title="Checkout" />} />
      <Route path="/order/:orderNumber" element={<Placeholder title="Order" />} />
      <Route path="/privacy" element={<Placeholder title="Privacy" />} />
      <Route path="*" element={<Placeholder title="Page not found" />} />
    </Routes>
  );
}

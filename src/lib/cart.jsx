// The shopping cart. Any page can read or change it with useCart().
import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'oja-cart-v1';

// Same limits as the database's place_order function.
export const MAX_QTY = 10;
export const MAX_LINES = 20;

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  // Save the cart whenever it changes, so it survives a page refresh.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // If the browser blocks storage, the cart still works until the page is closed.
    }
  }, [items]);

  // item = { variant_id, product_name, label, price_kobo }
  function add(item) {
    setItems((prev) => {
      const existing = prev.find((i) => i.variant_id === item.variant_id);
      if (existing) {
        return prev.map((i) =>
          i.variant_id === item.variant_id
            ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + 1) }
            : i
        );
      }
      if (prev.length >= MAX_LINES) return prev;
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function setQuantity(variantId, quantity) {
    const q = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(quantity) || 1)));
    setItems((prev) =>
      prev.map((i) => (i.variant_id === variantId ? { ...i, quantity: q } : i))
    );
  }

  function remove(variantId) {
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price_kobo * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, setQuantity, remove, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

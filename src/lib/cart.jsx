// The shopping cart. Any page can read or change it with useCart().
// Guests: the cart is kept on this device only.
// Signed in: the cart is also saved in Supabase (table "carts"), so it stays
// in sync across the website and the mobile app, live.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { useAuth } from './auth.jsx';

const CartContext = createContext(null);
const STORAGE_KEY = 'oja-cart-v1';
// Remembers whose cart is on this device, and whether it has changes
// that have not reached the database yet.
const META_KEY = 'oja-cart-meta-v1';
const SAVE_DELAY_MS = 500;

// Same limits as the database's place_order function.
export const MAX_QTY = 10;
export const MAX_LINES = 20;

// Makes sure a cart list is safe to use: no duplicates, sensible numbers, max 20 lines.
function cleanItems(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (!item || item.variant_id === undefined || item.variant_id === null) continue;
    if (out.some((o) => o.variant_id === item.variant_id)) continue;
    const quantity = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(item.quantity) || 1)));
    const price_kobo = Math.max(0, Math.floor(Number(item.price_kobo) || 0));
    out.push({ ...item, quantity, price_kobo });
    if (out.length >= MAX_LINES) break;
  }
  return out;
}

// Turns a cart into text with a fixed key order, so two carts can be compared.
function cartKey(list) {
  return JSON.stringify(
    list.map((item) =>
      Object.keys(item)
        .sort()
        .reduce((obj, k) => {
          obj[k] = item[k];
          return obj;
        }, {})
    )
  );
}

// Combines the saved cart with a guest cart (keeps the higher quantity of each item).
function mergeCarts(remote, local) {
  const merged = cleanItems(remote);
  for (const item of cleanItems(local)) {
    const existing = merged.find((i) => i.variant_id === item.variant_id);
    if (existing) {
      existing.quantity = Math.max(existing.quantity, item.quantity);
    } else if (merged.length < MAX_LINES) {
      merged.push(item);
    }
  }
  return merged;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return cleanItems(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

function readMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return { owner: parsed?.owner ?? null, dirty: Boolean(parsed?.dirty) };
  } catch {
    return { owner: null, dirty: false };
  }
}

function writeMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Storage blocked: syncing still works while the page is open.
  }
}

async function fetchSavedCart(userId) {
  return supabase.from('carts').select('items').eq('user_id', userId).maybeSingle();
}

export function CartProvider({ children }) {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  const [items, setItems] = useState(loadCart);
  // 'local' (guest), 'syncing', 'synced' or 'error'
  const [syncStatus, setSyncStatus] = useState('local');
  const [retryCount, setRetryCount] = useState(0);

  const itemsRef = useRef(items);
  const syncedUserId = useRef(null); // whose saved cart has been loaded
  const loadingCart = useRef(false);
  const lastSaved = useRef(null); // the cart as the database has it
  const saveTimer = useRef(null);
  const saving = useRef(false);
  const prevUserId = useRef(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Keep a copy on this device, so it survives a page refresh.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // If the browser blocks storage, the cart still works until the page is closed.
    }
  }, [items]);

  // When someone signs in: load their saved cart and combine it with this device's cart.
  // When someone signs out: empty the cart on this device (it stays saved in their account).
  useEffect(() => {
    if (loading) return;
    const prev = prevUserId.current;
    prevUserId.current = userId;

    if (!userId) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      syncedUserId.current = null;
      lastSaved.current = null;
      setSyncStatus('local');
      if (prev) {
        setItems([]);
        writeMeta({ owner: null, dirty: false });
      }
      return;
    }

    if (syncedUserId.current === userId) return;

    let cancelled = false;
    loadingCart.current = true;
    setSyncStatus('syncing');

    (async () => {
      const { data, error } = await fetchSavedCart(userId);
      loadingCart.current = false;
      if (cancelled) return;
      if (error) {
        console.error('Could not load saved cart:', error.message);
        setSyncStatus('error');
        return;
      }

      const remote = cleanItems(data?.items);
      const local = itemsRef.current;
      const meta = readMeta();

      let next;
      if (meta.owner === userId) {
        // This device already had this person's cart. Use the device copy only
        // if it has changes the database never received.
        next = meta.dirty ? local : remote;
      } else if (meta.owner) {
        // The device cart belonged to a different account: don't mix them.
        next = remote;
      } else {
        // Guest cart: keep what they added before signing in.
        next = mergeCarts(remote, local);
      }

      lastSaved.current = data ? cartKey(remote) : null;
      syncedUserId.current = userId;
      writeMeta({ owner: userId, dirty: cartKey(next) !== lastSaved.current });
      setItems(next);
      setSyncStatus('synced');
    })();

    return () => {
      cancelled = true;
      loadingCart.current = false;
    };
  }, [userId, loading, retryCount]);

  // Save changes to the database shortly after they happen.
  useEffect(() => {
    if (!userId || syncedUserId.current !== userId) return;
    const snapshot = cartKey(items);
    if (snapshot === lastSaved.current) return;

    writeMeta({ owner: userId, dirty: true });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      saving.current = true;
      const { error } = await supabase
        .from('carts')
        .upsert({ user_id: userId, items, updated_at: new Date().toISOString() });
      saving.current = false;

      if (error) {
        console.error('Could not save cart:', error.message);
        setSyncStatus('error');
        return;
      }
      lastSaved.current = snapshot;
      if (cartKey(itemsRef.current) === snapshot) {
        writeMeta({ owner: userId, dirty: false });
      }
      setSyncStatus('synced');
    }, SAVE_DELAY_MS);
  }, [items, userId, retryCount]);

  // Live updates: when the cart changes on another device, show it here.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`cart-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carts', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          if (syncedUserId.current !== userId) return;
          if (saveTimer.current || saving.current) return; // our own newer change is on its way
          if (lastSaved.current !== null && cartKey(itemsRef.current) !== lastSaved.current) return;

          const remote = cleanItems(payload.new?.items);
          const remoteKey = cartKey(remote);
          lastSaved.current = remoteKey;
          if (remoteKey !== cartKey(itemsRef.current)) setItems(remote);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Safety net for phones: re-check the saved cart when the tab/app comes back
  // into view or the internet reconnects (live connections can drop in the background).
  useEffect(() => {
    if (!userId) return;

    async function refresh() {
      if (document.visibilityState === 'hidden') return;

      if (syncedUserId.current !== userId) {
        if (!loadingCart.current) setRetryCount((n) => n + 1); // retry loading
        return;
      }
      if (saveTimer.current || saving.current) return;
      if (cartKey(itemsRef.current) !== lastSaved.current) {
        setRetryCount((n) => n + 1); // retry a save that failed
        return;
      }

      const { data, error } = await fetchSavedCart(userId);
      if (error || !data) return;
      if (saveTimer.current || saving.current) return;
      if (cartKey(itemsRef.current) !== lastSaved.current) return;

      const remote = cleanItems(data.items);
      const remoteKey = cartKey(remote);
      lastSaved.current = remoteKey;
      if (remoteKey !== cartKey(itemsRef.current)) setItems(remote);
    }

    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [userId]);

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
    <CartContext.Provider
      value={{ items, add, setQuantity, remove, clear, count, subtotal, syncStatus }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

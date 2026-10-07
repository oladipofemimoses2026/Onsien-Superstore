// The home page: lists every product with its sizes and an "Add to cart" button.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { formatNaira } from '../lib/money.js';
import { useCart, MAX_QTY } from '../lib/cart.jsx';

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('id, slug, name, description, sort_order, product_variants (id, label, price_kobo, stock, sort_order)')
        .eq('active', true)
        .order('sort_order');

      if (error) {
        console.error(error);
        setError('Could not load products. Please refresh the page.');
      } else {
        // Put each product's sizes in their intended order (e.g. 100g before 250g).
        const sorted = data.map((p) => ({
          ...p,
          product_variants: [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order),
        }));
        setProducts(sorted);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="page muted">Loading the pantry…</p>;
  if (error) return <p className="page error">{error}</p>;

  return (
    <div className="page">
      <section className="hero">
        <h1>Ọjà Pantry</h1>
        <p>Nigerian spices, sauces and soup essentials, delivered to your door. Free delivery on orders from ₦30,000.</p>
      </section>

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }) {
  const { items, add } = useCart();
  const variants = product.product_variants;
  const firstInStock = variants.find((v) => v.stock > 0) || variants[0];
  const [selectedId, setSelectedId] = useState(firstInStock?.id);
  const [justAdded, setJustAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId);
  if (!selected) return null;

  const inCart = items.find((i) => i.variant_id === selected.id)?.quantity || 0;
  const soldOut = selected.stock <= 0;
  const atLimit = inCart >= Math.min(MAX_QTY, selected.stock);

  function handleAdd() {
    add({
      variant_id: selected.id,
      product_name: product.name,
      label: selected.label,
      price_kobo: selected.price_kobo,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <article className="product-card">
      <h2>{product.name}</h2>
      <p className="muted">{product.description}</p>

      <div className="variant-options">
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className={'variant-btn' + (v.id === selectedId ? ' active' : '')}
            onClick={() => setSelectedId(v.id)}
            disabled={v.stock <= 0}
            title={v.stock <= 0 ? 'Sold out' : ''}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="card-footer">
        <span className="price">{formatNaira(selected.price_kobo)}</span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={soldOut || atLimit}
        >
          {soldOut ? 'Sold out' : atLimit ? 'Max in cart' : justAdded ? 'Added ✓' : 'Add to cart'}
        </button>
      </div>

      {inCart > 0 && <p className="small muted">{inCart} in your cart</p>}
    </article>
  );
}

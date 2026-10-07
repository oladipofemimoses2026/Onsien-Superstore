// Paystack sends the customer here after paying: /payment/callback?reference=...
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatNaira } from '../lib/money.js';
import { startPayment, PENDING_ORDER_KEY } from '../lib/payment.js';

function getPendingOrder() {
  try {
    return localStorage.getItem(PENDING_ORDER_KEY);
  } catch {
    return null;
  }
}

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');

  const [status, setStatus] = useState('checking'); // checking | paid | failed
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const alreadyChecked = useRef(false);

  useEffect(() => {
    // Only check once, even if React runs this twice.
    if (alreadyChecked.current) return;
    alreadyChecked.current = true;

    if (!reference) {
      setStatus('failed');
      setError('We could not find a payment reference. The payment may have been cancelled.');
      return;
    }

    async function verify() {
      try {
        const res = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        });
        const json = await res.json().catch(() => ({}));

        if (res.ok) {
          setResult(json);
          setStatus('paid');
          try {
            localStorage.removeItem(PENDING_ORDER_KEY);
          } catch {
            // Not critical.
          }
        } else {
          setStatus('failed');
          setError(json.error || 'We could not confirm your payment.');
        }
      } catch {
        setStatus('failed');
        setError('We could not reach the server. Please check your connection and refresh this page.');
      }
    }
    verify();
  }, [reference]);

  async function retry() {
    const pendingOrder = getPendingOrder();
    if (!pendingOrder) return;
    setRetrying(true);
    setError('');
    try {
      await startPayment(pendingOrder);
    } catch (err) {
      setError(err.message);
      setRetrying(false);
    }
  }

  if (status === 'checking') {
    return (
      <div className="page narrow center">
        <h1>Confirming your payment…</h1>
        <p className="muted">Please don't close this page.</p>
      </div>
    );
  }

  if (status === 'paid') {
    return (
      <div className="page narrow center">
        <div className="success-badge">✓</div>
        <h1>Thank you! Your order is confirmed.</h1>
        <p>
          Order number: <strong>{result.order_number}</strong>
        </p>
        <p>
          Total paid: <strong>{formatNaira(result.total_kobo)}</strong>
        </p>
        <p className="muted">
          {result.email_sent
            ? `A confirmation email has been sent to ${result.email}.`
            : `Your payment is confirmed. The confirmation email to ${result.email} may take a few minutes.`}
        </p>
        <Link to="/" className="btn btn-primary">Continue shopping</Link>
      </div>
    );
  }

  const canRetry = Boolean(getPendingOrder());

  return (
    <div className="page narrow center">
      <h1>Payment not completed</h1>
      <p className="error">{error}</p>
      <p className="muted">No money has been taken unless Paystack told you the payment was successful.</p>
      <div className="actions center">
        {canRetry && (
          <button type="button" className="btn btn-primary" onClick={retry} disabled={retrying}>
            {retrying ? 'Opening Paystack…' : 'Try payment again'}
          </button>
        )}
        <Link to="/" className="btn">Back to shop</Link>
      </div>
    </div>
  );
}

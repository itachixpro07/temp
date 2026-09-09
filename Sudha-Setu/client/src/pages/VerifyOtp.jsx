import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { Notice } from '../components/Ui';

export default function VerifyOtp() {
  const { confirmOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Verifying also signs the user in, so we can go straight to the app.
      await confirmOtp(email.trim(), code.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="text-2xl">Confirm your email</h1>
      <p className="mt-2 text-[15px] text-muted">
        Enter the six-digit code we sent{email ? ` to ${email}` : ''}. It expires in 10 minutes.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {!location.state?.email && (
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </div>
        )}

        <div>
          <label htmlFor="code" className="label">
            Six-digit code
          </label>
          <input
            id="code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="field text-center text-2xl tracking-[0.4em]"
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" className="btn-primary w-full" disabled={busy || code.length < 6}>
          {busy ? 'Confirming…' : 'Confirm and continue'}
        </button>
      </form>

      {/* server-v2 issues verify_email codes only during registration, so a
          lost code means registering again with the same details. */}
      <p className="mt-6 text-sm text-muted">
        Code expired or never arrived? Register again with the same email, or{' '}
        <Link to="/signin" className="text-tulsi underline underline-offset-4">
          go back to sign in
        </Link>
        .
      </p>
    </div>
  );
}

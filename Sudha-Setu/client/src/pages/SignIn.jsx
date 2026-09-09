import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as api from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { Notice } from '../components/Ui';

// Google sign-in is only mounted by the backend when GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL are all set, so it is shown
// only when the client is told it is available.
const googleEnabled = import.meta.env.VITE_GOOGLE_AUTH === 'true';

export default function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(form.email.trim(), form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      // The backend returns 403 when the email has not been verified yet.
      if (err.status === 403) {
        navigate('/verify', { state: { email: form.email.trim() } });
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="text-2xl">Sign in</h1>
      <p className="mt-2 text-[15px] text-muted">Continue where you left off.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set('email')}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={set('password')}
            className="field"
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {googleEnabled && (
        <a href={api.googleLoginUrl()} className="btn-quiet mt-3 w-full">
          Continue with Google
        </a>
      )}

      <div className="mt-6 space-y-2 text-sm text-muted">
        <p>
          <Link to="/reset" className="text-tulsi underline underline-offset-4">
            Forgot your password?
          </Link>
        </p>
        <p>
          New here?{' '}
          <Link to="/register" className="text-tulsi underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

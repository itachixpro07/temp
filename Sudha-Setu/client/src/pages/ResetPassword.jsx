import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../lib/api';
import { Notice } from '../components/Ui';

// Two steps against two endpoints: forgot-password mails a code,
// reset-password consumes it.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request');
  const [form, setForm] = useState({ email: '', code: '', newPassword: '' });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const request = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.forgotPassword(form.email.trim());
      setMessage(res.message);
      setStep('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(form.email.trim(), form.code.trim(), form.newPassword);
      navigate('/signin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="text-2xl">Reset your password</h1>

      {step === 'request' ? (
        <>
          <p className="mt-2 text-[15px] text-muted">
            We will email you a code to set a new password.
          </p>
          <form onSubmit={request} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                className="field"
              />
            </div>

            {error && <Notice tone="error">{error}</Notice>}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        </>
      ) : (
        <>
          {message && (
            <div className="mt-4">
              <Notice>{message}</Notice>
            </div>
          )}
          <form onSubmit={reset} className="mt-6 space-y-4">
            <div>
              <label htmlFor="code" className="label">
                Six-digit code
              </label>
              <input
                id="code"
                inputMode="numeric"
                maxLength={6}
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                className="field text-center text-2xl tracking-[0.4em]"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="label">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.newPassword}
                onChange={set('newPassword')}
                className="field"
              />
              <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
            </div>

            {error && <Notice tone="error">{error}</Notice>}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-sm text-muted">
        <Link to="/signin" className="text-tulsi underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

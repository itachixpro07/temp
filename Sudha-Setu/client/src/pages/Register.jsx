import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../lib/api';
import { Notice } from '../components/Ui';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', abhaId: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors(null);
    try {
      await api.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        abhaId: form.abhaId.trim(),
      });
      // Registration emails a 6-digit code; the account cannot sign in until
      // it is confirmed.
      navigate('/verify', { state: { email: form.email.trim() } });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.errors || null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="text-2xl">Create your account</h1>
      <p className="mt-2 text-[15px] text-muted">
        You will get a six-digit code by email to confirm it is you.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="label">
            Full name
          </label>
          <input
            id="name"
            required
            maxLength={120}
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
            className="field"
          />
        </div>

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

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            className="field"
          />
          <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
        </div>

        <div>
          <label htmlFor="abhaId" className="label">
            ABHA ID <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="abhaId" value={form.abhaId} onChange={set('abhaId')} className="field" />
        </div>

        {error && (
          <Notice tone="error">
            {error}
            {fieldErrors && (
              <ul className="mt-1.5 space-y-1">
                {Object.entries(fieldErrors).map(([field, msg]) => (
                  <li key={field}>{msg}</li>
                ))}
              </ul>
            )}
          </Notice>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already registered?{' '}
        <Link to="/signin" className="text-tulsi underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

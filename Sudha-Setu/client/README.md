# Sudha Setu — patient frontend

React 18 + Vite + Tailwind. Talks to the existing `server-v2` backend over REST.
No backend file was modified to build this.

## Running it

The backend must be running first.

```bash
cd server-v2 && npm install && npm run dev     # http://localhost:5000
cd client    && npm install && cp .env.example .env && npm run dev
```

The client runs on port 5173, which is already the default in the backend's
`CLIENT_ORIGINS`, so CORS works with no change. If you run the backend on a
different port, set `VITE_API_URL` in `client/.env`.

If the Conditions and Remedies pages are empty, seed the knowledge base:

```bash
cd server-v2 && npm run seed
```

## How auth works here

`server-v2` issues JWTs as **httpOnly cookies** and never returns a token in a
response body. So this client:

- sends `credentials: 'include'` on every request (`src/lib/api.js`)
- stores no token anywhere — it cannot read the cookie, by design
- calls `GET /api/auth/me` on boot to discover whether a session exists
- on a 401 carrying `code: TOKEN_EXPIRED`, calls `POST /api/auth/refresh` once
  and replays the request; parallel 401s share a single refresh

Registration always creates a `patient`. Elevated roles are admin-assigned, so
no role field is ever sent. Login returns 403 until the emailed OTP is
confirmed, which the sign-in page handles by redirecting to `/verify`.

The case PDF is fetched with `fetch` and opened as a blob rather than linked
directly, because in production the auth cookie is `SameSite=strict` and would
not travel with a cross-origin navigation.

## Endpoints used

| Page | Endpoint |
| --- | --- |
| Sign in / register / verify / reset | `POST /api/auth/login`, `/register`, `/verify-otp`, `/forgot-password`, `/reset-password`, `/logout`, `/refresh`, `GET /api/auth/me` |
| Home — symptoms | `POST /api/cases/intake` |
| Home — assistant | `POST /api/ai/chat`, `GET /api/ai/chat/:chatId` |
| Conditions, Remedies | `GET /api/kb` (public, no auth) |
| Account history | `GET /api/cases/:id` |
| Case sheet | `GET /api/cases/:id`, `GET /api/cases/:id/pdf` |

Voice input uses the browser's native Web Speech API and involves no backend
and no third party. It needs Chrome or Edge; elsewhere the mic is disabled and
typing still works.

## Known gaps in the backend

These are places where the UI is limited by a missing endpoint. Nothing here is
faked or mocked.

1. **No `GET /api/cases/mine`.** A patient cannot list their own cases —
   `/api/cases/queue` is doctor/admin only and `/api/cases/:id` needs an ID you
   already hold. `src/lib/caseStore.js` works around this by remembering case
   IDs in `localStorage` and fetching each one. History therefore does not
   follow the user across devices. The case sheets themselves are always safe
   in MongoDB; only the local index is fragile. Delete that module once the
   endpoint exists.
2. **No chat session list.** Same workaround, for the same reason.
3. **Socket.IO cannot be authenticated from a browser.** The socket middleware
   reads `handshake.auth.token`, but the JWT only ever exists in an httpOnly
   cookie that JavaScript cannot read. No realtime feature is wired up here
   because no browser client can connect. Having the socket middleware fall
   back to parsing the cookie header would fix it.
4. **No profile update endpoint.** `phone` and `languagePreference` exist on
   the User model but nothing writes them, so Account shows them read-only.
5. **No hospital endpoint.** `models/Hospital.js` has no controller or route.
   The Hospitals page ships real emergency numbers and a maps hand-off rather
   than an invented directory.
6. **No resend-OTP endpoint.** Verification codes are only issued at
   registration and expire in 10 minutes.
7. **No appointment or OPD-slot model.** Tier 2 booking described in the spec
   has nothing behind it; medium-danger cases are queued for a doctor, which is
   what the backend actually does.

## Not built yet

Doctor and admin consoles. The endpoints exist and are solid
(`GET /api/doctor/queue`, `PATCH /api/cases/:id`, `/api/admin/*`,
`POST|PUT|DELETE /api/kb`), so those are the natural next screens.

## Structure

```
src/
  lib/       api.js (every backend call), useAuth.jsx, useSpeech.js,
             caseStore.js (localStorage workaround), format.js
  components/ Layout.jsx, SosModal.jsx, Ui.jsx
  pages/     Home, Diseases, Medicines, Hospitals, Account, CaseDetail,
             SignIn, Register, VerifyOtp, ResetPassword, NotFound
```

Every network call lives in `src/lib/api.js`. Nothing else calls `fetch`.

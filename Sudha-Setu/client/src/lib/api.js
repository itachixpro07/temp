// Thin wrapper over the server-v2 REST API.
//
// Auth model (important): server-v2 issues JWTs as httpOnly cookies and never
// returns a token in a response body. So every request must send credentials,
// and there is nothing for us to store. On a 401 with code TOKEN_EXPIRED we
// call /api/auth/refresh once and replay the original request.

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status, code, errors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

let refreshing = null;

const refreshOnce = () => {
  // Collapse parallel 401s into a single refresh call.
  if (!refreshing) {
    refreshing = fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
};

const parse = async (res) => {
  const body = await res.text();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return { message: body };
  }
};

async function send(path, { method = 'GET', body, retry = true } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    const data = await parse(res);
    if (data?.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshOnce();
      if (refreshed.ok) return send(path, { method, body, retry: false });
    }
    throw new ApiError(data?.message || 'Please sign in again', {
      status: 401,
      code: data?.code,
    });
  }

  const data = await parse(res);

  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed (${res.status})`, {
      status: res.status,
      code: data?.code,
      errors: data?.errors,
    });
  }

  return data;
}

const get = (p) => send(p);
const post = (p, body) => send(p, { method: 'POST', body });

const qs = (params) => {
  const clean = Object.entries(params).filter(([, v]) => v !== '' && v != null);
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};

/* ---------------------------------------------------------------- auth --- */
// POST /api/auth/register -> 201 { message, user: { id, email } }
// Note: the backend always assigns role 'patient' here; elevated roles are
// admin-assigned, so we deliberately do not send a role field.
export const register = ({ name, email, password, abhaId }) =>
  post('/api/auth/register', { name, email, password, ...(abhaId ? { abhaId } : {}) });

// POST /api/auth/login -> { user } (403 if email not yet verified)
export const login = (email, password) => post('/api/auth/login', { email, password });

// POST /api/auth/verify-otp -> { user }; this also logs the user in.
export const verifyOtp = (email, code) => post('/api/auth/verify-otp', { email, code });

export const forgotPassword = (email) => post('/api/auth/forgot-password', { email });

export const resetPassword = (email, code, newPassword) =>
  post('/api/auth/reset-password', { email, code, newPassword });

export const logout = () => post('/api/auth/logout');

// GET /api/auth/me -> { user: { id, name, email, role, abhaId } }
export const me = () => get('/api/auth/me');

// Google sign-in is a full-page redirect: the backend sets cookies and then
// redirects back to CLIENT_URL. Only mounted when Google env vars are set.
export const googleLoginUrl = () => `${BASE}/api/auth/google`;

/* --------------------------------------------------------------- cases --- */
// POST /api/cases/intake -> 201 {
//   caseId, dangerLevel, confidenceScore, status, verifiedAdvice,
//   requiresHumanReview, matchedKeywords, emergency
// }
export const intake = ({ patientText, languageUsed, symptoms, ayurvedicMarkers, location }) =>
  post('/api/cases/intake', {
    patientText,
    ...(languageUsed ? { languageUsed } : {}),
    ...(symptoms?.length ? { symptoms } : {}),
    ...(ayurvedicMarkers ? { ayurvedicMarkers } : {}),
    ...(location ? { location } : {}),
  });

// GET /api/cases/:id -> { case }
export const getCase = (id) => get(`/api/cases/${id}`);

// GET /api/cases/:id/pdf -> application/pdf
//
// Fetched as a blob rather than linked directly: in production the auth cookie
// is SameSite=strict, so a plain cross-origin <a href> would not be
// authenticated. Caller is responsible for revoking the returned URL.
export const casePdfUrl = async (id) => {
  const res = await fetch(`${BASE}/api/cases/${id}/pdf`, { credentials: 'include' });
  if (!res.ok) {
    const data = await parse(res);
    throw new ApiError(data?.message || 'Could not open this case sheet', { status: res.status });
  }
  return URL.createObjectURL(await res.blob());
};

/* ------------------------------------------------------------------ ai --- */
// POST /api/ai/chat -> { reply, chatId, messageCount }
export const sendChat = ({ message, chatId, caseId }) =>
  post('/api/ai/chat', {
    message,
    ...(chatId ? { chatId } : {}),
    ...(caseId ? { caseId } : {}),
  });

// GET /api/ai/chat/:chatId -> { chatId, caseId, messages, messageCount, createdAt, updatedAt }
export const getChat = (chatId) => get(`/api/ai/chat/${chatId}`);

/* ------------------------------------------------------- knowledge base --- */
// GET /api/kb -> { page, limit, total, totalPages, rules }
// Public: no auth required, so this powers the signed-out Diseases/Medicines pages.
export const listRules = ({ search, dangerLevel, page, limit } = {}) =>
  get(`/api/kb${qs({ search, dangerLevel, page, limit })}`);

// GET /api/kb/:id -> { rule }
export const getRule = (id) => get(`/api/kb/${id}`);

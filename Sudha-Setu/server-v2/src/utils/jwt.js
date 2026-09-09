import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or shorter than 32 characters. Set a long random value in .env'
    );
  }
  return secret;
};

export const generateAccessToken = (userId, role) =>
  jwt.sign({ sub: String(userId), role }, getSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuer: 'sudha-setu',
  });

export const generateRefreshToken = (userId) =>
  jwt.sign({ sub: String(userId) }, getSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'sudha-setu',
  });

export const verifyToken = (token) =>
  jwt.verify(token, getSecret(), { issuer: 'sudha-setu' });

const toMs = (expr) => {
  const match = expr.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; 
  const n = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * multipliers[unit];
};

const cookieDefaults = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
  };
};

export const setTokenCookies = (res, accessToken, refreshToken) => {
  const defaults = cookieDefaults();

  setAccessTokenCookie(res, accessToken);

  res.cookie('refreshToken', refreshToken, {
    ...defaults,
    maxAge: toMs(REFRESH_TOKEN_EXPIRES_IN),
  });
};

export const setAccessTokenCookie = (res, accessToken) => {
  res.cookie('accessToken', accessToken, {
    ...cookieDefaults(),
    maxAge: toMs(ACCESS_TOKEN_EXPIRES_IN),
  });
};

export const clearTokenCookies = (res) => {
  const defaults = cookieDefaults();

  res.clearCookie('accessToken', defaults);
  res.clearCookie('refreshToken', defaults);
};

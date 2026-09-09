import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = '15m';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or shorter than 32 characters. Set a long random value in .env'
    );
  }
  return secret;
};

export const assertJwtConfig = () => {
  getSecret();
};

export const signAccessToken = ({ id, role }) =>
  jwt.sign({ sub: String(id), role }, getSecret(), {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    issuer: 'sudha-setu',
  });

export const verifyAccessToken = (token) =>
  jwt.verify(token, getSecret(), { issuer: 'sudha-setu' });

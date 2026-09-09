import { verifyAccessToken } from '../config/jwt.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  
  let token = req.cookies?.accessToken;

  if (!token) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      token = header.slice(7).trim();
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorised: no token provided' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      message: expired ? 'Session expired, please log in again' : 'Not authorised: invalid token',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return res.status(401).json({ message: 'Not authorised: account no longer exists' });
  }

  req.user = user;
  next();
};

export const authorize = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      
      return next(new Error('authorize() requires protect() to run first'));
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: this action requires one of [${roles.join(', ')}]`,
      });
    }

    next();
  };
};

import crypto from 'node:crypto';
import User, { USER_ROLES } from '../models/User.js';
import Otp from '../models/Otp.js';
import { sendOtpEmail } from '../services/emailService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  setTokenCookies,
  setAccessTokenCookie,
  clearTokenCookies,
} from '../utils/jwt.js';

const SELF_ASSIGNABLE_ROLES = ['patient'];

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  abhaId: user.abhaId ?? null,
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const issueTokensAndRespond = async (res, user, statusCode = 200) => {
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  setTokenCookies(res, accessToken, refreshToken);

  res.status(statusCode).json({ user: toPublicUser(user) });
};

const issueTokensAndRespondRedirect = async (res, user) => {
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  setTokenCookies(res, accessToken, refreshToken);

  res.redirect(process.env.CLIENT_URL || '/');
};

const generateOtpCode = () => String(crypto.randomInt(100000, 999999));

const sendOtpFor = async (user, purpose) => {
  const code = generateOtpCode();
  await Otp.deleteMany({ userId: user._id, purpose });
  await Otp.create({
    userId: user._id,
    code,
    purpose,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  await sendOtpEmail(user.email, user.name, code, purpose);
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, abhaId, role } = req.body ?? {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    if (role && !SELF_ASSIGNABLE_ROLES.includes(role)) {
      return res.status(403).json({
        message: `Cannot self-register as '${role}'. Elevated roles are assigned by an admin.`,
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      abhaId: abhaId || undefined,
      role: 'patient',
    });

    await sendOtpFor(user, 'verify_email');

    res.status(201).json({
      message: 'Account created. Check your email for a verification code.',
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        errors: Object.fromEntries(
          Object.entries(err.errors).map(([field, e]) => [field, e.message])
        ),
      });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: 'An account with these details already exists' });
    }
    next(err);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, code } = req.body ?? {};
    if (!email || !code) {
      return res.status(400).json({ message: 'email and code are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    const otp = await Otp.findOne({
      userId: user._id,
      code,
      purpose: 'verify_email',
      expiresAt: { $gt: new Date() },
    });
    if (!otp) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    await Otp.deleteOne({ _id: otp._id });
    user.emailVerified = true;
    await user.save({ validateBeforeSave: false });

    await issueTokensAndRespond(res, user, 200);
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      await sendOtpFor(user, 'reset_password');
    }

    res.status(200).json({
      message: 'If an account with that email exists, a reset code has been sent.',
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body ?? {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'email, code and newPassword are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const otp = await Otp.findOne({
      userId: user._id,
      code,
      purpose: 'reset_password',
      expiresAt: { $gt: new Date() },
    });
    if (!otp) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    await Otp.deleteOne({ _id: otp._id });
    user.password = newPassword;
    user.refreshToken = null;
    await user.save();

    res.status(200).json({ message: 'Password reset. Please log in with your new password.' });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        errors: Object.fromEntries(
          Object.entries(err.errors).map(([field, e]) => [field, e.message])
        ),
      });
    }
    next(err);
  }
};

export const googleCallback = async (req, res, next) => {
  try {
    await issueTokensAndRespondRedirect(res, req.user);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (user && !user.password) {
      return res.status(400).json({ message: 'This account uses Google sign-in, not a password' });
    }

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in' });
    }

    await issueTokensAndRespond(res, user, 200);
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    
    const token =
      req.cookies?.refreshToken ||
      (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7).trim());

    if (token) {
      const hashed = hashToken(token);
      
      await User.findOneAndUpdate({ refreshToken: hashed }, { refreshToken: null });
    }

    clearTokenCookies(res);

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    
    const token =
      req.cookies?.refreshToken ||
      (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7));

    if (!token) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const hashed = hashToken(token);
    const user = await User.findOne({ _id: payload.sub }).select('+refreshToken');

    if (!user || user.refreshToken !== hashed) {
      return res.status(401).json({ message: 'Refresh token revoked or invalid' });
    }

    const newAccessToken = generateAccessToken(user._id, user.role);

    setAccessTokenCookie(res, newAccessToken);

    res.status(200).json({ message: 'Access token refreshed' });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res) => {
  res.json({ user: toPublicUser(req.user) });
};

export { USER_ROLES };

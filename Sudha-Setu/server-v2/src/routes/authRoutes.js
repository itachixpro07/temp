import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';

import {
  register,
  login,
  logout,
  refresh,
  getMe,
  verifyOtp,
  forgotPassword,
  resetPassword,
  googleCallback,
} from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { googleAuthEnabled } from '../config/passport.js';

const router = Router();

const IS_PROD = process.env.NODE_ENV === 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PROD ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !IS_PROD,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PROD ? 5 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !IS_PROD,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password', otpLimiter, resetPassword);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', protect, getMe);

if (googleAuthEnabled) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get(
    '/google/callback',
    passport.authenticate('google', {
      session: false,
      failureRedirect: process.env.CLIENT_URL || '/',
    }),
    googleCallback
  );
}

export default router;

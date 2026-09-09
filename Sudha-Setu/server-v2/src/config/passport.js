import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import User from '../models/User.js';

export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
);

if (googleAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('Google account has no email address'));

            user = await User.findOne({ email });

            if (user) {
              user.googleId = profile.id;
              user.emailVerified = true;
              await user.save({ validateBeforeSave: false });
            } else {
              user = await User.create({
                name: profile.displayName,
                email,
                googleId: profile.id,
                emailVerified: true,
                role: 'patient',
              });
            }
          }

          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

export default passport;

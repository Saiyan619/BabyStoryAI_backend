const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');

console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
  process.exit(1);
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/parent/auth/google/callback',
      scope: ['openid', 'email', 'profile'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          return done(null, user);
        }

        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          user.googleId = profile.id;
          user.isEmailVerified = true;
          user.name = user.name || profile.displayName;
          await user.save();
          return done(null, user);
        }

        user = new User({
          email: profile.emails[0].value,
          name: profile.displayName,
          googleId: profile.id,
          isEmailVerified: true,
        });
        await user.save();
        done(null, user);
      } catch (error) {
        console.error('OAuth error:', error.message);
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
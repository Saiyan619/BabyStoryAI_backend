const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const auth = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');
const passport = require('../passport');

// Google OAuth
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['openid', 'email', 'profile'], prompt: 'select_account' })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
  }
);

// Register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }
    user = new User({ email, password, name });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      console.log('No user found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    console.log('Password match for', email, ':', isMatch);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const token = crypto.randomBytes(20).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();
    const resetUrl = `http://localhost:5173/reset-password/${token}`;
    const message = `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`;
    await sendEmail(user.email, 'BabyStory Password Reset', message);
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    console.log('Hashed token:', hashedToken);
    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    });
    if (!user) {
      console.log('No user found for token');
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('New hashed password:', hashedPassword);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          resetToken: undefined,
          resetTokenExpiry: undefined,
          updatedAt: Date.now(),
        },
      }
    );
    console.log('Password reset for:', user.email);
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify Password Request
router.post('/verify-password/request', auth, async (req, res) => {
  try {
    console.log('Request user:', req.user);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log('User not found for ID:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    console.log('Generated code:', verificationCode);
    user.verificationCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
    user.verificationCodeExpiry = Date.now() + 600000;
    console.log('Hashed code:', user.verificationCode);
    await user.save();
    const message = `Your BabyStory verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.`;
    console.log('Sending email to:', user.email);
    await sendEmail(user.email, 'BabyStory Verification Code', message);
    res.json({ message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Verify error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get User
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Me error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
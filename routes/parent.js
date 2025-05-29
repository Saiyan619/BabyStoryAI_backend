const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); 
const User = require('../models/User');
const Settings = require('../models/Settings');
const Story = require('../models/Story');
const auth = require('../middleware/auth');
const router = express.Router();
const sendEmail = require('../utils/sendEmail')

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: 'Email already exists' });

    user = new User({ email, password });
    await user.save();

    const settings = new Settings({ userId: user._id });
    await settings.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.put('/settings', auth, async (req, res) => {
  try {
    const { storyLength, allowedThemes, timeLimit, voiceInput, illustrations } = req.body;
    const settings = await Settings.findOneAndUpdate(
      { userId: req.user.id },
      { storyLength, allowedThemes, timeLimit, voiceInput, illustrations },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/stories', auth, async (req, res) => {
  try {
    const stories = await Story.find({ userId: req.user.id });
    res.json(stories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// GET /api/parent/me - Get authenticated user's profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/parent/me - Update authenticated user's profile
router.put('/me', auth, async (req, res) => {
  const { email, password, name } = req.body;

  // Build update object
  const updates = {};
  if (email) updates.email = email.trim().toLowerCase();
  if (typeof name !== 'undefined') updates.name = name.trim();
  if (password) {
    const salt = await bcrypt.genSalt(10);
    updates.password = await bcrypt.hash(password, salt);
  }
  updates.updatedAt = Date.now();

  try {
    // Check if email is taken by another user
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error(error.message);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
  
});

// POST /api/parent/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    // Send reset email
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`; // Update for production
    const message = `You requested a password reset. Click the link to reset your password: ${resetUrl}\n\nIf you didn't request this, ignore this email.`;

    await sendEmail(user.email, 'Password Reset Request', message);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/parent/reset-password/:token - Reset password
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    user.updatedAt = Date.now();
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/parent/verify-password/request - Send 4-digit verification code
router.post('/verify-password/request', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Generate 4-digit code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    user.verificationCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
    user.verificationCodeExpiry = Date.now() + 600000; // 10 minutes expiry
    await user.save();

    // Send email
    const message = `Your BabyStory verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.`;

    await sendEmail(user.email, 'BabyStory Verification Code', message);

    res.json({ message: 'Verification code sent to your email' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/parent/verify-password/verify - Verify 4-digit code
router.post('/verify-password/verify', auth, async (req, res) => {
  const { code } = req.body;

  if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  try {
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const user = await User.findOne({
      _id: req.user.id,
      verificationCode: hashedCode,
      verificationCodeExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    user.updatedAt = Date.now();
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
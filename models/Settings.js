const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storyLength: { type: String, default: 'short', enum: ['short', 'medium', 'long'] },
  allowedThemes: { type: [String], default: ['adventure', 'animals', 'fantasy'] },
  timeLimit: { type: Number, default: 30 },
  voiceInput: { type: Boolean, default: true },
  illustrations: { type: Boolean, default: true },
});

module.exports = mongoose.model('Settings', SettingsSchema);
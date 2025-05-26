const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prompt: { type: String, required: true },
  text: { type: String, required: true },
  theme: { type: String },
  createdAt: { type: Date, default: Date.now },
  approved: { type: Boolean, default: false },
});

module.exports = mongoose.model('Story', StorySchema);
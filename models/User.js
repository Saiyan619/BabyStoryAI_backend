const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String },
  name: { type: String, trim: true, default: '' },
  googleId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  verificationCode: { type: String },
  verificationCodeExpiry: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
});

UserSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password && !this.password.match(/^\$2[ayb]\$/)) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

UserSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);
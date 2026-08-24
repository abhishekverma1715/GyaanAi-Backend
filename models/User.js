const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true, maxlength: 50 },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true, minlength: 6, select: false },
  avatar:     { type: String },
  theme:      { type: String, enum: ['dark','light'], default: 'dark' },
  aiProvider: { type: String, default: 'auto' },
  plan:       { type: String, enum: ['free','pro','enterprise'], default: 'free' },
  msgCount:   { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (this.isModified('email')) {
    this.email = String(this.email || '').trim().toLowerCase();
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.avatar) this.avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${this.name}`;
  next();
});

UserSchema.methods.matchPassword = async function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', UserSchema);

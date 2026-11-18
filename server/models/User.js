const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  avatar: {
    type: String,
    default: '',
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true,
  },
  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', UserSchema);

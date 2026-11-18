const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const StudyPlan = require('../models/StudyPlan');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bettercourse_super_secret_jwt_key_2026';
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '330212907264-qc0uuld2o3jnjj8ksi0frtski141clsb.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// In-memory user store fallback
let memoryUsers = [];
let nextUserId = 1;

function generateToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

// 1. Email/Password Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password are required.' } });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (password.length < 6) {
      return res.status(400).json({ error: { message: 'Password must be at least 6 characters.' } });
    }

    let existing = null;
    if (mongoose.connection.readyState === 1) {
      try {
        existing = await User.findOne({ email: cleanEmail });
      } catch {}
    } else {
      existing = memoryUsers.find((u) => u.email === cleanEmail);
    }

    if (existing) {
      return res.status(409).json({ error: { message: 'An account with this email already exists.' } });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = new mongoose.Types.ObjectId();
    const newUser = {
      _id: userId,
      id: userId.toString(),
      email: cleanEmail,
      name: name ? name.trim() : cleanEmail.split('@')[0],
      passwordHash,
      provider: 'local',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
      createdAt: new Date(),
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await User.create(newUser);
      } catch (e) {
        memoryUsers.push(newUser);
      }
    } else {
      memoryUsers.push(newUser);
    }

    const token = generateToken(newUser.id, cleanEmail);
    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: { message: 'Failed to create account.' } });
  }
});

// 2. Email/Password Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password are required.' } });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = null;

    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ email: cleanEmail });
      } catch {}
    } else {
      user = memoryUsers.find((u) => u.email === cleanEmail);
    }

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: { message: 'Invalid email or password.' } });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: { message: 'Invalid email or password.' } });
    }

    const userId = user._id ? user._id.toString() : user.id;
    const token = generateToken(userId, cleanEmail);
    return res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: { message: 'Failed to sign in.' } });
  }
});

// 3. Google OAuth Login / Signup
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: { message: 'Google credential token is required.' } });
    }

    let payload = null;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token verification failed:', err.message);
      return res.status(401).json({ error: { message: 'Google authentication verification failed.' } });
    }

    const { sub: googleId, email, name, picture } = payload;
    const cleanEmail = email.toLowerCase();

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ $or: [{ googleId }, { email: cleanEmail }] });
      } catch {}
    } else {
      user = memoryUsers.find((u) => u.googleId === googleId || u.email === cleanEmail);
    }

    if (user) {
      if (!user.googleId) user.googleId = googleId;
      if (!user.avatar && picture) user.avatar = picture;
      if (mongoose.connection.readyState === 1) {
        try { await user.save(); } catch {}
      }
    } else {
      const userId = new mongoose.Types.ObjectId();
      user = {
        _id: userId,
        id: userId.toString(),
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        googleId,
        avatar: picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
        provider: 'google',
        createdAt: new Date(),
      };
      if (mongoose.connection.readyState === 1) {
        try { await User.create(user); } catch {}
      } else {
        memoryUsers.push(user);
      }
    }

    const userId = user._id ? user._id.toString() : user.id;
    const token = generateToken(userId, cleanEmail);
    return res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ error: { message: 'Google login failed.' } });
  }
});

// 4. Current User Profile
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// 5. Logout
router.post('/logout', (req, res) => {
  return res.json({ status: 'ok', message: 'Logged out successfully.' });
});

// 6. My Courses for Logged-In User
router.get('/my-courses', requireAuth, async (req, res) => {
  try {
    let plans = [];
    if (mongoose.connection.readyState === 1) {
      try {
        plans = await StudyPlan.find({ userId: req.user._id }).sort({ created_at: -1 });
      } catch (e) {
        console.warn('My courses fetch notice:', e.message);
      }
    }

    if (plans.length === 0) {
      const apiRoutes = require('./api');
      const allMemPlans = apiRoutes.getMemoryPlans ? apiRoutes.getMemoryPlans() : [];
      plans = allMemPlans.filter(p => !p.userId || String(p.userId) === String(req.user.id) || String(p.userId) === String(req.user._id));
      if (plans.length === 0 && allMemPlans.length > 0) {
        plans = allMemPlans;
      }
    }

    return res.json({
      courses: plans.map((p) => {
        const completedVideos = (p.videos || []).filter((v) => v.completed).length;
        const totalVideos = (p.videos || []).length;
        const progressPercentage = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

        return {
          id: p.id,
          playlistId: p.playlist_id,
          title: p.playlist_title,
          thumbnail: p.playlist_thumbnail,
          videoCount: p.video_count || totalVideos,
          hoursPerWeek: p.hours_per_week,
          targetDate: p.target_date,
          intensity: p.study_intensity || 'Balanced',
          progressPercentage,
          createdAt: p.created_at,
        };
      }),
    });
  } catch (err) {
    return res.status(500).json({ error: { message: 'Failed to fetch saved courses.' } });
  }
});

router.getMemoryUser = function (id) {
  return memoryUsers.find((u) => u.id === id || String(u._id) === String(id));
};

module.exports = router;

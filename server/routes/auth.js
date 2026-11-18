const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

function generateToken(userId, email) {
  return jwt.sign({ userId, email }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

// 1. Email/Password Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (password.length < 6) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters long.' },
      });
    }

    const db = getDb();
    const existing = await db.collection('users').findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({
        error: { code: 'USER_EXISTS', message: 'An account with this email already exists.' },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      email: cleanEmail,
      name: name ? name.trim() : cleanEmail.split('@')[0],
      passwordHash,
      provider: 'local',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
      createdAt: new Date(),
    };

    const result = await db.collection('users').insertOne(newUser);
    const userId = result.insertedId.toString();
    const token = generateToken(userId, cleanEmail);

    return res.status(201).json({
      token,
      user: {
        id: userId,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create account.' },
    });
  }
});

// 2. Email/Password Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getDb();
    const user = await db.collection('users').findOne({ email: cleanEmail });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    const userId = user._id.toString();
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
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to sign in.' },
    });
  }
});

// 3. Google OAuth Login / Signup
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Google credential token is required.' },
      });
    }

    // Verify token with Google
    let payload = null;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token verification failed:', err.message);
      return res.status(401).json({
        error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Failed to verify Google sign-in.' },
      });
    }

    const { sub: googleId, email, name, picture } = payload;
    const cleanEmail = email.toLowerCase();
    const db = getDb();

    // Check if user already exists with this googleId or email
    let user = await db.collection('users').findOne({
      $or: [{ googleId }, { email: cleanEmail }],
    });

    if (user) {
      // Update Google info if not present
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (!user.avatar && picture) updates.avatar = picture;
      if (Object.keys(updates).length > 0) {
        await db.collection('users').updateOne({ _id: user._id }, { $set: updates });
      }
    } else {
      // Create new Google-authenticated user
      const newUser = {
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        googleId,
        avatar: picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
        provider: 'google',
        createdAt: new Date(),
      };
      const result = await db.collection('users').insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    const userId = user._id.toString();
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
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Google authentication failed.' },
    });
  }
});

// 4. Get Current User Profile
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    user: req.user,
  });
});

// 5. Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ status: 'ok', message: 'Logged out successfully.' });
});

module.exports = router;

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'bettercourse_super_secret_jwt_key_2026';

async function findUserById(userId) {
  if (mongoose.connection.readyState === 1) {
    try {
      const user = await User.findById(userId);
      if (user) return user;
    } catch {}
  }
  try {
    const authRoutes = require('../routes/auth');
    if (typeof authRoutes.getMemoryUser === 'function') {
      return authRoutes.getMemoryUser(userId);
    }
  } catch {}
  return null;
}

async function requireAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' },
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found. Please sign in again.' },
      });
    }

    req.user = {
      id: user._id ? user._id.toString() : user.id,
      _id: user._id || user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token.' },
    });
  }
}

async function optionalAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.userId);

    if (user) {
      req.user = {
        id: user._id ? user._id.toString() : user.id,
        _id: user._id || user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      };
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }

  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
};

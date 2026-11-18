const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const config = require('../config');
const { getDb } = require('../db');

async function requireAuth(req, res, next) {
  try {
    let token = null;

    // Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in.',
        },
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const db = getDb();
    
    // Look up user
    let user = null;
    try {
      user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    } catch {
      user = await db.collection('users').findOne({ id: decoded.userId });
    }

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User no longer exists. Please sign in again.',
        },
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token. Please sign in again.',
      },
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

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const db = getDb();

    let user = null;
    try {
      user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    } catch {
      user = await db.collection('users').findOne({ id: decoded.userId });
    }

    if (user) {
      req.user = {
        id: user._id.toString(),
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

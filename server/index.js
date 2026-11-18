const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { connectDB, getDb } = require('./db');

const authRoutes = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const plansRoutes = require('./routes/plans');
const playlistsRoutes = require('./routes/playlists');

const app = express();

// Security & Parsing Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost and any client requests in unified/production
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
    },
  },
});
app.use('/api/', apiLimiter);

// Health Check
app.get('/api/health', (req, res) => {
  try {
    const db = getDb();
    return res.json({
      status: 'ok',
      database: db ? 'connected' : 'disconnected',
      environment: config.NODE_ENV,
    });
  } catch {
    return res.json({
      status: 'ok',
      database: 'connecting',
      environment: config.NODE_ENV,
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/playlists', playlistsRoutes);

// Unified Frontend Serving (Single-Domain Production)
const distPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distPath)) {
  console.log(`[Unified Server] Serving frontend build from: ${distPath}`);
  app.use(express.static(distPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected server error occurred.',
    },
  });
});

// Start Server
async function startServer() {
  try {
    await connectDB();
    const server = app.listen(config.PORT, () => {
      console.log(`\n==================================================`);
      console.log(`🚀 StudyFlow Unified MERN Server running on port ${config.PORT}`);
      console.log(`📡 Health check: http://localhost:${config.PORT}/api/health`);
      console.log(`🔑 Google Auth Client ID active`);
      console.log(`==================================================\n`);
    });

    return server;
  } catch (err) {
    console.error('[Server Startup Failure]:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

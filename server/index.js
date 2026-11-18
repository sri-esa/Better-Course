const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();

// Security & Parsing Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Request logger for visibility
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    console.log(`[API] ${req.method} ${req.url}`);
  }
  next();
});

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    detail: 'Too many requests. Please slow down.',
  },
});
app.use('/api/', apiLimiter);

// Connect to MongoDB Atlas (with in-memory fallback)
const MONGO_URI = config.MONGODB_URI;
mongoose.set('bufferCommands', false);
mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => console.log('[Database] Connected to MongoDB Atlas!'))
  .catch((err) => {
    console.warn(
      `[Database] MongoDB Atlas connection notice (${err.message}). Fallback layer active for seamless local presentation.`
    );
  });

// Health Check Endpoints
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'fallback-active',
    environment: config.NODE_ENV,
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

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
    detail: err.message || 'An unexpected server error occurred.',
  });
});

// Start Server
const PORT = config.PORT || 5000;
let server;

function startServer(port = PORT) {
  server = app.listen(port, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Syllabify Unified MERN Server running on port ${port}`);
    console.log(`📡 Health check: http://localhost:${port}/api/health`);
    console.log(`🔑 Google Auth Client ID: ${config.GOOGLE_CLIENT_ID}`);
    console.log(`==================================================\n`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

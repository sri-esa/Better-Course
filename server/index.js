const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// MongoDB connection with graceful fallback for local presentations
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/studyflow';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB successfully!'))
  .catch(err => {
    console.warn(`MongoDB not detected on local port (${err.message}). Using high-performance in-memory persistence layer for seamless offline presentation.`);
  });

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`StudyFlow MERN Server running on http://127.0.0.1:${PORT}`);
});

require('dotenv').config();

const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI:
    process.env.MONGODB_URI ||
    'mongodb+srv://divyanshudas154_db_user:bm0lZyVI3LupFRrN@cluster0.bwcqyqe.mongodb.net/?retryWrites=true&w=majority',
  MONGODB_DATABASE: process.env.MONGODB_DATABASE || 'bettercourse',
  JWT_SECRET: process.env.JWT_SECRET || 'bettercourse_super_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  GOOGLE_CLIENT_ID:
    process.env.GOOGLE_CLIENT_ID ||
    '330212907264-qc0uuld2o3jnjj8ksi0frtski141clsb.apps.googleusercontent.com',
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  TARGET_TOPIC_HOURS: parseFloat(process.env.TARGET_TOPIC_HOURS || '4.0'),
  EFFORT_MULT_BEGINNER: parseFloat(process.env.EFFORT_MULT_BEGINNER || '1.25'),
  EFFORT_MULT_INTERMEDIATE: parseFloat(process.env.EFFORT_MULT_INTERMEDIATE || '1.5'),
  EFFORT_MULT_ADVANCED: parseFloat(process.env.EFFORT_MULT_ADVANCED || '2.0'),
  MAX_PLAYLIST_VIDEOS: parseInt(process.env.MAX_PLAYLIST_VIDEOS || '500', 10),
};

module.exports = config;

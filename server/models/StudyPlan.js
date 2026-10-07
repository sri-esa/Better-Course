const mongoose = require('mongoose');

// Video schema
const VideoSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  youtube_video_id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  duration_seconds: { type: Number, default: 0 },
  position: { type: Number, required: true },
  topic_id: { type: Number },
  completed: { type: Boolean, default: false }
});

// Topic schema
const TopicSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  difficulty: { type: String, default: 'FOUNDATION' }, // FOUNDATION, INTERMEDIATE, ADVANCED
  order_number: { type: Number, default: 1 },
  total_duration_seconds: { type: Number, default: 0 },
  estimated_effort_minutes: { type: Number, default: 0 },
  video_positions: [{ type: Number }]
});

// Weekly plan schema
const WeeklyPlanSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  week_number: { type: Number, required: true },
  topic_id: { type: Number, required: true },
  deadline: { type: String, required: true },
  estimated_minutes: { type: Number, default: 0 }
});

// Study Plan schema
const StudyPlanSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  playlist_id: { type: Number, required: true },
  youtube_playlist_id: { type: String, required: true },
  playlist_title: { type: String, required: true },
  playlist_thumbnail: { type: String },
  video_count: { type: Number, default: 0 },
  total_duration_seconds: { type: Number, default: 0 },
  hours_per_week: { type: Number, default: 8 },
  target_date: { type: String, required: true },
  study_intensity: { type: String, default: 'Balanced' },
  topics: [TopicSchema],
  videos: [VideoSchema],
  weekly_plans: [WeeklyPlanSchema],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StudyPlan', StudyPlanSchema);

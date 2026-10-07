const express = require('express');
const router = express.Router();
const StudyPlan = require('../models/StudyPlan');
const { getPlaylistData, formatDuration } = require('../services/youtube');
const { clusterAndNameTopics } = require('../services/clustering');
const { calculateStudyEffort, calculateSchedule } = require('../services/scheduler');

// In-memory store fallback when MongoDB instance is not connected
let memoryPlans = [];
let nextPlanId = 1;

/**
 * Builds the complete response object for the client
 */
function buildFullPlanResponse(plan) {
  const completedVideos = plan.videos.filter(v => v.completed);
  const completedCount = completedVideos.length;
  const completedDuration = completedVideos.reduce((acc, v) => acc + (v.duration_seconds || 0), 0);
  const totalCount = plan.videos.length;
  const overallPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const effortData = calculateStudyEffort(plan.total_duration_seconds, plan.study_intensity || 'Balanced');
  const totalEffortHours = effortData.effort_hours;
  const hoursDone = Math.round(((completedDuration * 1.5) / 3600) * 10) / 10;
  const hoursRemaining = Math.max(0, Math.round((totalEffortHours - hoursDone) * 10) / 10);

  // Topics with completion calculation
  const topicsResponse = plan.topics.map(t => {
    const tVideos = plan.videos.filter(v => t.video_positions.includes(v.position));
    const tCompletedCount = tVideos.filter(v => v.completed).length;
    const tTotal = tVideos.length;
    const tPercentage = tTotal > 0 ? Math.round((tCompletedCount / tTotal) * 100) : 0;

    const mins = t.estimated_effort_minutes || 0;
    const effortFormatted = mins >= 60 
      ? `${Math.floor(mins / 60)}h ${mins % 60}m` 
      : `${mins}m`;

    return {
      id: t.id,
      name: t.name,
      difficulty: t.difficulty,
      order_number: t.order_number,
      total_duration_seconds: t.total_duration_seconds,
      total_duration_formatted: formatDuration(t.total_duration_seconds),
      estimated_effort_minutes: mins,
      estimated_effort_formatted: effortFormatted,
      video_count: tTotal,
      completed_video_count: tCompletedCount,
      completion_percentage: tPercentage,
      videos: tVideos.map(v => ({
        id: v.id,
        youtube_video_id: v.youtube_video_id,
        title: v.title,
        description: v.description,
        duration_seconds: v.duration_seconds,
        duration_formatted: formatDuration(v.duration_seconds),
        position: v.position,
        completed: !!v.completed
      }))
    };
  });

  // Weekly plan with populated videos
  const weeklyPlansResponse = plan.weekly_plans.map(w => {
    const topic = plan.topics.find(t => t.id === w.topic_id);
    const tVideos = topic ? plan.videos.filter(v => topic.video_positions.includes(v.position)) : [];
    const mins = w.estimated_minutes || 0;
    const effortFormatted = mins >= 60 
      ? `${Math.floor(mins / 60)}h ${mins % 60}m` 
      : `${mins}m`;

    return {
      id: w.id,
      week_number: w.week_number,
      topic_id: w.topic_id,
      topic_name: w.topic_name || (topic ? topic.name : 'Module'),
      difficulty: w.difficulty || (topic ? topic.difficulty : 'FOUNDATION'),
      deadline: w.deadline,
      estimated_minutes: mins,
      estimated_effort_formatted: effortFormatted,
      videos: tVideos.map(v => ({
        id: v.id,
        youtube_video_id: v.youtube_video_id,
        title: v.title,
        description: v.description,
        duration_seconds: v.duration_seconds,
        duration_formatted: formatDuration(v.duration_seconds),
        position: v.position,
        completed: !!v.completed
      }))
    };
  });

  const scheduleData = calculateSchedule(
    plan.topics,
    plan.hours_per_week,
    plan.target_date,
    plan.study_intensity || 'Balanced'
  );

  let targetDateFormatted = plan.target_date;
  try {
    const d = new Date(plan.target_date);
    if (!isNaN(d.getTime())) {
      targetDateFormatted = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch (e) {}

  return {
    id: plan.id,
    playlist_id: plan.playlist_id,
    playlist_title: plan.playlist_title,
    playlist_thumbnail: plan.playlist_thumbnail,
    youtube_playlist_id: plan.youtube_playlist_id,
    total_videos: plan.video_count,
    total_duration_seconds: plan.total_duration_seconds,
    total_duration_formatted: formatDuration(plan.total_duration_seconds),
    estimated_study_effort_hours: totalEffortHours,
    hours_per_week: plan.hours_per_week,
    target_date: plan.target_date,
    target_date_formatted: targetDateFormatted,
    status: scheduleData.status,
    required_hours_per_week: scheduleData.required_hours_per_week,
    is_feasible: scheduleData.is_feasible,
    overall_progress_percentage: overallPercentage,
    completed_videos: completedCount,
    hours_completed: hoursDone,
    hours_remaining: hoursRemaining,
    current_week: 1,
    study_intensity: plan.study_intensity || 'Balanced',
    weekly_plans: weeklyPlansResponse,
    topics: topicsResponse
  };
}

/**
 * POST /api/playlists/analyze
 */
router.post('/playlists/analyze', async (req, res) => {
  try {
    const { playlist_url, hours_per_week = 8, target_date, study_intensity = 'Balanced' } = req.body;

    if (!playlist_url) {
      return res.status(400).json({ detail: 'Playlist URL is required' });
    }

    // 1. Fetch playlist data
    const data = await getPlaylistData(playlist_url);

    // 2. Group into topics (Gemini AI or fallback)
    const rawTopics = await clusterAndNameTopics(data.videos);

    // 3. Populate topic durations & effort
    const enrichedTopics = rawTopics.map((t, idx) => {
      const tVideos = data.videos.filter(v => t.video_positions.includes(v.position));
      const tDuration = tVideos.reduce((acc, v) => acc + (v.duration_seconds || 0), 0);
      const effort = calculateStudyEffort(tDuration, study_intensity);
      return {
        id: idx + 1,
        name: t.name,
        difficulty: t.difficulty,
        order_number: idx + 1,
        total_duration_seconds: tDuration,
        estimated_effort_minutes: effort.effort_minutes,
        video_positions: t.video_positions
      };
    });

    // 4. Calculate schedule
    const scheduleData = calculateSchedule(enrichedTopics, hours_per_week, target_date, study_intensity);

    const planId = nextPlanId++;
    const newPlan = {
      id: planId,
      playlist_id: planId,
      youtube_playlist_id: data.youtube_playlist_id,
      playlist_title: data.title,
      playlist_thumbnail: data.thumbnail_url,
      video_count: data.video_count,
      total_duration_seconds: data.total_duration_seconds,
      hours_per_week: Number(hours_per_week || 8),
      target_date: target_date || '2026-11-30',
      study_intensity,
      topics: enrichedTopics,
      videos: data.videos,
      weekly_plans: scheduleData.weekly_plans,
      created_at: new Date()
    };

    // Save to memory store
    memoryPlans.push(newPlan);

    // Try saving to MongoDB if connected
    try {
      await StudyPlan.create(newPlan);
    } catch (e) {
      // Memory store provides fail-safe reliability
    }

    return res.json(buildFullPlanResponse(newPlan));
  } catch (err) {
    console.error('Error analyzing playlist:', err);
    return res.status(500).json({ detail: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/plans/latest/current
 */
router.get('/plans/latest/current', async (req, res) => {
  try {
    let plan = null;
    try {
      plan = await StudyPlan.findOne().sort({ created_at: -1 });
    } catch (e) {}

    if (!plan && memoryPlans.length > 0) {
      plan = memoryPlans[memoryPlans.length - 1];
    }

    if (!plan) {
      return res.status(404).json({ detail: 'No study plan exists yet. Create one first!' });
    }

    return res.json(buildFullPlanResponse(plan));
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

/**
 * GET /api/plans/:planId
 */
router.get('/plans/:planId', async (req, res) => {
  try {
    const id = parseInt(req.params.planId, 10);
    let plan = null;
    try {
      plan = await StudyPlan.findOne({ id });
    } catch (e) {}

    if (!plan) {
      plan = memoryPlans.find(p => p.id === id);
    }

    if (!plan) {
      return res.status(404).json({ detail: 'Study plan not found' });
    }

    return res.json(buildFullPlanResponse(plan));
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

/**
 * GET /api/playlists/:playlistId
 */
router.get('/playlists/:playlistId', async (req, res) => {
  try {
    const id = parseInt(req.params.playlistId, 10);
    let plan = null;
    try {
      plan = await StudyPlan.findOne({ playlist_id: id });
    } catch (e) {}

    if (!plan) {
      plan = memoryPlans.find(p => p.playlist_id === id);
    }

    if (!plan) {
      return res.status(404).json({ detail: 'Playlist not found' });
    }

    return res.json(buildFullPlanResponse(plan));
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

/**
 * PATCH /api/progress/:videoId
 */
router.patch('/progress/:videoId', async (req, res) => {
  try {
    const videoId = parseInt(req.params.videoId, 10);
    const { completed } = req.body;

    // Update in memory store
    for (const plan of memoryPlans) {
      const v = plan.videos.find(item => item.id === videoId);
      if (v) {
        v.completed = completed;
      }
    }

    // Try MongoDB
    try {
      await StudyPlan.updateMany(
        { "videos.id": videoId },
        { "$set": { "videos.$.completed": completed } }
      );
    } catch (e) {}

    return res.json({ status: 'success', video_id: videoId, completed });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

/**
 * POST /api/plans/:planId/replan
 */
router.post('/plans/:planId/replan', async (req, res) => {
  try {
    const id = parseInt(req.params.planId, 10);
    let plan = memoryPlans.find(p => p.id === id);

    if (!plan) {
      try {
        plan = await StudyPlan.findOne({ id });
      } catch (e) {}
    }

    if (!plan) {
      return res.status(404).json({ detail: 'Study plan not found' });
    }

    // Filter uncompleted topics
    const uncompletedTopics = plan.topics.filter(t => {
      const tVideos = plan.videos.filter(v => t.video_positions.includes(v.position));
      return tVideos.some(v => !v.completed);
    });

    const topicsToSchedule = uncompletedTopics.length > 0 ? uncompletedTopics : plan.topics;
    const recalculated = calculateSchedule(
      topicsToSchedule,
      plan.hours_per_week,
      plan.target_date,
      plan.study_intensity || 'Balanced'
    );

    plan.weekly_plans = recalculated.weekly_plans;

    try {
      await StudyPlan.updateOne({ id }, { "$set": { weekly_plans: recalculated.weekly_plans } });
    } catch (e) {}

    return res.json(buildFullPlanResponse(plan));
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;

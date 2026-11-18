const express = require('express');
const { getDb } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { schedulePlan } = require('../services/scheduler');

const router = express.Router();

// 1. Get All Courses for Logged-In User
router.get('/my-courses', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const plans = await db
      .collection('plans')
      .find({ userId: req.user.id })
      .sort({ created_at: -1 })
      .toArray();

    return res.json({
      courses: plans.map((p) => ({
        id: p.id,
        title: p.playlist?.title || 'Study Plan',
        channelTitle: p.playlist?.channel_title || '',
        videoCount: p.playlist?.video_count || 0,
        hoursPerWeek: p.settings?.hours_per_week || 0,
        startDate: p.settings?.start_date,
        targetDate: p.settings?.target_date,
        completionDate: p.summary?.completion_date,
        totalWeeks: p.summary?.total_weeks || 0,
        feasible: p.summary?.feasible ?? true,
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    console.error('Fetch my-courses error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch courses.' },
    });
  }
});

// 2. Get Plan by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const plan = await db.collection('plans').findOne({ id });

    if (!plan) {
      return res.status(404).json({
        error: { code: 'PLAN_NOT_FOUND', message: 'Study plan not found.' },
      });
    }

    // Attach user progress
    const progressList = await db
      .collection('progress')
      .find({ plan_id: id, completed: true })
      .toArray();

    const completedVideoIds = new Set(progressList.map((p) => p.youtube_video_id));

    // Mark completed status on videos in weeks
    if (Array.isArray(plan.weeks)) {
      plan.weeks.forEach((w) => {
        w.topics.forEach((t) => {
          (t.videos || []).forEach((v) => {
            v.completed = completedVideoIds.has(v.youtube_video_id);
          });
        });
      });
    }

    // If user is logged in and plan has no owner, claim it!
    if (req.user && !plan.userId) {
      await db.collection('plans').updateOne({ id }, { $set: { userId: req.user.id } });
      plan.userId = req.user.id;
    }

    return res.json(plan);
  } catch (error) {
    console.error('Get plan error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve plan.' },
    });
  }
});

// 3. Update Progress (Toggle video completion)
router.patch('/:id/progress', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Updates array is required.' },
      });
    }

    const db = getDb();
    const plan = await db.collection('plans').findOne({ id });
    if (!plan) {
      return res.status(404).json({
        error: { code: 'PLAN_NOT_FOUND', message: 'Study plan not found.' },
      });
    }

    for (const update of updates) {
      const { youtube_video_id, completed, actual_seconds } = update;
      await db.collection('progress').updateOne(
        { plan_id: id, youtube_video_id },
        {
          $set: {
            completed: Boolean(completed),
            completed_at: completed ? new Date() : null,
            actual_seconds: actual_seconds || null,
          },
        },
        { upsert: true }
      );
    }

    return res.json({ status: 'ok', updated: updates.length });
  } catch (error) {
    console.error('Update progress error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update progress.' },
    });
  }
});

// 4. Dynamic Re-planning
router.post('/:id/replan', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { hours_per_week, target_date } = req.body;

    const db = getDb();
    const plan = await db.collection('plans').findOne({ id });
    if (!plan) {
      return res.status(404).json({
        error: { code: 'PLAN_NOT_FOUND', message: 'Study plan not found.' },
      });
    }

    // Get completed video IDs
    const progressList = await db
      .collection('progress')
      .find({ plan_id: id, completed: true })
      .toArray();

    const completedVideoIds = new Set(progressList.map((p) => p.youtube_video_id));

    // Filter topics to remaining uncompleted videos
    const remainingTopics = [];
    (plan.topics || []).forEach((t) => {
      const remainingVids = (t.videos || []).filter(
        (v) => !completedVideoIds.has(v.youtube_video_id)
      );
      if (remainingVids.length > 0) {
        const remainingHours = Math.max(
          0.3,
          Math.round(
            (t.hours * (remainingVids.length / Math.max(1, t.videos.length))) * 10
          ) / 10
        );
        remainingTopics.push({
          ...t,
          hours: remainingHours,
          videos: remainingVids,
        });
      }
    });

    const newHours = hours_per_week ? parseFloat(hours_per_week) : plan.settings.hours_per_week;
    const newTarget = target_date !== undefined ? target_date : plan.settings.target_date;
    const today = new Date().toISOString().split('T')[0];

    const replannedSchedule = schedulePlan({
      topics: remainingTopics.length > 0 ? remainingTopics : plan.topics,
      hoursPerWeek: newHours,
      startDate: today,
      targetDate: newTarget,
    });

    const updatedPlan = {
      ...plan,
      settings: {
        ...plan.settings,
        hours_per_week: newHours,
        target_date: newTarget,
      },
      summary: {
        ...replannedSchedule.summary,
        replan_count: (plan.summary?.replan_count || 0) + 1,
      },
      weeks: replannedSchedule.weeks,
      topic_deadlines: replannedSchedule.topic_deadlines,
      updated_at: new Date(),
    };

    await db.collection('plans').updateOne({ id }, { $set: updatedPlan });

    return res.json(updatedPlan);
  } catch (error) {
    console.error('Replan error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to replan schedule.' },
    });
  }
});

// 5. Delete Plan
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = await db.collection('plans').deleteOne({ id, userId: req.user.id });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found or unauthorized.' },
      });
    }

    await db.collection('progress').deleteMany({ plan_id: id });
    return res.json({ status: 'ok', message: 'Plan deleted successfully.' });
  } catch (error) {
    console.error('Delete plan error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete plan.' },
    });
  }
});

module.exports = router;

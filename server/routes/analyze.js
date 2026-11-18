const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { parsePlaylistId, fetchPlaylistMetadata } = require('../services/youtube');
const { getOrClusterTopics } = require('../services/clustering');
const { buildTopics } = require('../services/effort');
const { schedulePlan } = require('../services/scheduler');

const router = express.Router();

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { playlist_url, hours_per_week, start_date, target_date, clustering_method } = req.body;

    if (!playlist_url) {
      return res.status(400).json({
        error: { code: 'INVALID_URL', message: 'Playlist URL or ID is required.' },
      });
    }

    const hours = parseFloat(hours_per_week);
    if (!hours || hours <= 0) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'hours_per_week must be greater than 0.' },
      });
    }

    const playlistId = parsePlaylistId(playlist_url);
    const startDate = start_date || new Date().toISOString().split('T')[0];
    const targetDate = target_date || null;

    if (targetDate && targetDate < startDate) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'target_date cannot be before start_date.' },
      });
    }

    const db = getDb();

    // 1. Fetch Playlist Metadata (cached or live)
    let playlist = await db.collection('playlists').findOne({ youtube_playlist_id: playlistId });
    if (!playlist) {
      playlist = await fetchPlaylistMetadata(playlistId);
      await db.collection('playlists').insertOne({
        ...playlist,
        id: uuidv4(),
        fetched_at: new Date(),
      });
    }

    if (!playlist.videos || playlist.videos.length === 0) {
      return res.status(422).json({
        error: { code: 'PLAYLIST_EMPTY', message: 'Playlist contains no usable videos.' },
      });
    }

    // 2. Topic Clustering
    const clusteringResult = await getOrClusterTopics(playlist.videos, clustering_method || 'llm');

    // 3. Effort Estimation & Topics Snapshot
    const topics = buildTopics(clusteringResult, playlist.videos);

    // 4. Deterministic Scheduling
    const schedule = schedulePlan({
      topics,
      hoursPerWeek: hours,
      startDate,
      targetDate,
    });

    // 5. Construct & Save Plan
    const planId = uuidv4();
    const planDoc = {
      id: planId,
      userId: req.user ? req.user.id : null,
      playlist: {
        id: playlist.id || uuidv4(),
        youtube_playlist_id: playlist.youtube_playlist_id,
        title: playlist.title,
        channel_title: playlist.channel_title,
        video_count: playlist.video_count,
        total_seconds: playlist.total_seconds,
        warnings: playlist.warnings || [],
      },
      settings: {
        hours_per_week: hours,
        start_date: startDate,
        target_date: targetDate,
      },
      summary: schedule.summary,
      topics,
      weeks: schedule.weeks,
      topic_deadlines: schedule.topic_deadlines,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection('plans').insertOne(planDoc);

    return res.status(201).json(planDoc);
  } catch (error) {
    console.error('Analyze error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to analyze playlist.' },
    });
  }
});

module.exports = router;

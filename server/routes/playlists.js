const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { parsePlaylistId, fetchPlaylistMetadata } = require('../services/youtube');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { playlist_url, refresh } = req.body;

    if (!playlist_url) {
      return res.status(400).json({
        error: { code: 'INVALID_URL', message: 'Playlist URL or ID is required.' },
      });
    }

    const playlistId = parsePlaylistId(playlist_url);
    const db = getDb();

    let playlist = null;
    if (!refresh) {
      playlist = await db.collection('playlists').findOne({ youtube_playlist_id: playlistId });
    }

    if (!playlist) {
      playlist = await fetchPlaylistMetadata(playlistId);
      playlist.id = uuidv4();
      playlist.fetched_at = new Date();

      await db.collection('playlists').updateOne(
        { youtube_playlist_id: playlistId },
        { $set: playlist },
        { upsert: true }
      );
    }

    return res.json(playlist);
  } catch (error) {
    console.error('Playlist inspect error:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch playlist.' },
    });
  }
});

module.exports = router;

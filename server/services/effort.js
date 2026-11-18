const config = require('../config');

function getMultiplier(difficulty) {
  const d = (difficulty || 'intermediate').toLowerCase();
  if (d === 'beginner' || d === 'easy') return config.EFFORT_MULT_BEGINNER;
  if (d === 'advanced' || d === 'hard') return config.EFFORT_MULT_ADVANCED;
  return config.EFFORT_MULT_INTERMEDIATE;
}

function calculateTopicEffort(videos, difficulty) {
  const mult = getMultiplier(difficulty);
  const totalSeconds = videos.reduce((acc, v) => acc + (v.duration_seconds || 0), 0);
  const effortHours = (totalSeconds / 3600) * mult;
  return Math.round(effortHours * 10) / 10;
}

function buildTopics(clusteringResult, videos) {
  const rawTopics = clusteringResult.topics || [];
  return rawTopics.map((t, idx) => {
    const start = t.start_index ?? 0;
    const end = t.end_index ?? start;
    const topicVideos = videos.slice(start, end + 1);

    const difficulty = t.difficulty || 'intermediate';
    const hours = calculateTopicEffort(topicVideos, difficulty);

    return {
      id: `topic_${idx + 1}`,
      name: t.name || `Topic ${idx + 1}`,
      difficulty,
      summary: t.summary || '',
      start_index: start,
      end_index: end,
      hours: Math.max(0.5, hours),
      videos: topicVideos,
    };
  });
}

module.exports = {
  getMultiplier,
  calculateTopicEffort,
  buildTopics,
};

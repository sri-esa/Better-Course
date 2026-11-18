const axios = require('axios');
const config = require('../config');

function durationChunking(videos, targetHours = 4.0) {
  const targetSeconds = targetHours * 3600;
  const n = videos.length;
  const topics = [];

  let startIdx = 0;
  let currSeconds = 0;

  for (let i = 0; i < n; i++) {
    currSeconds += videos[i].duration_seconds || 0;
    if ((currSeconds >= targetSeconds && i > startIdx) || i === n - 1) {
      let title = videos[startIdx]?.title || `Topic ${topics.length + 1}`;
      title = title.replace(/^\d+[\.\-\s]+/, '').trim();
      if (title.length > 50) title = title.substring(0, 47) + '...';

      topics.push({
        name: title,
        difficulty: topics.length === 0 ? 'beginner' : i === n - 1 ? 'advanced' : 'intermediate',
        summary: `Covers lessons ${startIdx + 1} to ${i + 1}.`,
        start_index: startIdx,
        end_index: i,
      });

      startIdx = i + 1;
      currSeconds = 0;
    }
  }

  return { topics };
}

async function clusterWithGemini(videos, targetHours = 4.0) {
  if (!config.GEMINI_API_KEY) {
    return durationChunking(videos, targetHours);
  }

  try {
    const videoDescriptions = videos.map((v, i) => ({
      index: i,
      title: v.title,
      duration_minutes: Math.round((v.duration_seconds || 0) / 60),
    }));

    const systemPrompt = `You are an expert curriculum designer. Group the ordered list of videos into coherent sequential study topics.
Rules:
1. Contiguous index ranges ONLY (no gaps, no overlaps).
2. Topics should be around ${targetHours} hours of total watch time.
3. Assess difficulty: 'beginner', 'intermediate', or 'advanced'.
4. Respond in valid JSON with schema: {"topics": [{"name": "string", "difficulty": "beginner|intermediate|advanced", "summary": "string", "start_index": number, "end_index": number}]}`;

    const userPrompt = `Here are the course videos:\n${JSON.stringify(videoDescriptions, null, 2)}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
    const response = await axios.post(
      endpoint,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      },
      { timeout: 30000 }
    );

    const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidate) {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed.topics) && parsed.topics.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Gemini Clustering] Fallback to duration chunking:', err.message);
  }

  return durationChunking(videos, targetHours);
}

async function getOrClusterTopics(videos, method = 'llm') {
  if (method === 'llm' && config.GEMINI_API_KEY) {
    return await clusterWithGemini(videos, config.TARGET_TOPIC_HOURS);
  }
  return durationChunking(videos, config.TARGET_TOPIC_HOURS);
}

module.exports = {
  durationChunking,
  clusterWithGemini,
  getOrClusterTopics,
};

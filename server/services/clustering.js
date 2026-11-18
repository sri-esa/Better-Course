const axios = require('axios');

/**
 * Deterministic fallback clustering when LLM is unavailable or offline
 */
function groupVideosFallback(videos) {
  const total = videos.length;
  if (total === 0) return [];

  const chunkSize = total > 12 ? 4 : (total >= 6 ? 3 : total);
  const topics = [];

  const defaultTemplates = [
    { name: "Foundations & Fundamentals", difficulty: "FOUNDATION" },
    { name: "Core Concepts & Mechanics", difficulty: "FOUNDATION" },
    { name: "Applied Principles & Methods", difficulty: "INTERMEDIATE" },
    { name: "Algorithms & Structural Workflows", difficulty: "INTERMEDIATE" },
    { name: "Advanced Techniques & Optimization", difficulty: "ADVANCED" },
    { name: "System Architecture & Deep Dive", difficulty: "ADVANCED" },
  ];

  let topicOrder = 1;
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = videos.slice(i, i + chunkSize);
    const positions = chunk.map(v => v.position);

    const firstTitle = chunk[0].title;
    const cleanTitle = firstTitle
      .replace(/^(lecture|video|tutorial|part|ch|chapter|\d+)[\s:\-#\.]*/i, '')
      .trim();
    const shortTitle = cleanTitle.length > 30 ? cleanTitle.substring(0, 28) + '...' : cleanTitle;

    const template = defaultTemplates[(topicOrder - 1) % defaultTemplates.length];
    const name = shortTitle ? `${shortTitle} & Related` : template.name;

    topics.push({
      id: topicOrder,
      name,
      difficulty: template.difficulty,
      order_number: topicOrder,
      video_positions: positions
    });
    topicOrder++;
  }

  return topics;
}

/**
 * Semantic topic grouping with Gemini LLM or clean fallback
 */
async function clusterAndNameTopics(videos) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    return groupVideosFallback(videos);
  }

  try {
    const summaryList = videos.map(v => `Position ${v.position}: ${v.title}`).join('\n');
    const prompt = `
You are an academic curriculum designer. Given this sequence of ordered YouTube videos from a course playlist:

${summaryList}

Group these videos into consecutive, cohesive academic topics (around 3 to 6 videos per topic).
Strictly preserve the original sequential order (do not shuffle video positions).
Assign each topic:
1. "name": A concise, professional academic topic title (e.g., "Process Fundamentals", "CPU Scheduling", "Virtual Memory").
2. "difficulty": Exactly one of "FOUNDATION", "INTERMEDIATE", or "ADVANCED".
3. "video_positions": The list of integer position numbers included in this topic.

Respond ONLY with valid JSON in this exact structure:
{
  "topics": [
    {
      "name": "Process Fundamentals",
      "difficulty": "FOUNDATION",
      "video_positions": [1, 2, 3, 4]
    }
  ]
}
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    let rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    const data = JSON.parse(rawText);
    if (Array.isArray(data.topics) && data.topics.length > 0) {
      return data.topics.map((t, idx) => ({
        id: idx + 1,
        name: t.name,
        difficulty: t.difficulty || 'FOUNDATION',
        order_number: idx + 1,
        video_positions: t.video_positions || []
      }));
    }

    return groupVideosFallback(videos);
  } catch (err) {
    console.warn(`Gemini clustering fallback triggered: ${err.message}`);
    return groupVideosFallback(videos);
  }
}

module.exports = {
  clusterAndNameTopics,
  groupVideosFallback
};

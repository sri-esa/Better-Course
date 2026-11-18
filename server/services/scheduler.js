function addDays(isoDateStr, days) {
  const d = new Date(isoDateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(startStr, endStr) {
  const d1 = new Date(startStr + 'T00:00:00Z');
  const d2 = new Date(endStr + 'T00:00:00Z');
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function schedulePlan({ topics, hoursPerWeek, startDate, targetDate = null }) {
  if (!hoursPerWeek || hoursPerWeek <= 0) {
    throw new Error('hoursPerWeek must be greater than 0.');
  }

  const weeks = [];
  let currentWeekNum = 1;
  let currentWeekStart = startDate;
  let currentWeekEnd = addDays(currentWeekStart, 6);
  let currentWeekHours = 0;
  let currentWeekTopics = [];

  const topicDeadlines = {};

  for (const topic of topics) {
    let remainingTopicHours = topic.hours;
    let partIndex = 1;
    const isSplittable = topic.hours > hoursPerWeek;
    const totalParts = isSplittable ? Math.ceil(topic.hours / hoursPerWeek) : 1;

    while (remainingTopicHours > 0) {
      const spaceInWeek = hoursPerWeek - currentWeekHours;

      // If week is full (or almost full) and we have not started this topic yet
      if (spaceInWeek <= 0.1) {
        weeks.push({
          week: currentWeekNum,
          start: currentWeekStart,
          end: currentWeekEnd,
          hours: Math.round(currentWeekHours * 10) / 10,
          topics: currentWeekTopics,
        });

        currentWeekNum += 1;
        currentWeekStart = addDays(currentWeekEnd, 1);
        currentWeekEnd = addDays(currentWeekStart, 6);
        currentWeekHours = 0;
        currentWeekTopics = [];
        continue;
      }

      if (remainingTopicHours <= spaceInWeek || !isSplittable) {
        // Fits in this week
        currentWeekTopics.push({
          topic_id: topic.id,
          name: topic.name,
          hours: Math.round(remainingTopicHours * 10) / 10,
          part: isSplittable ? partIndex : 1,
          total_parts: totalParts,
          videos: topic.videos || [],
        });
        currentWeekHours += remainingTopicHours;
        remainingTopicHours = 0;
        topicDeadlines[topic.id] = currentWeekEnd;
      } else {
        // Topic is bigger than remaining space
        const allocated = spaceInWeek;
        currentWeekTopics.push({
          topic_id: topic.id,
          name: topic.name,
          hours: Math.round(allocated * 10) / 10,
          part: partIndex,
          total_parts: totalParts,
          videos: topic.videos || [],
        });
        currentWeekHours += allocated;
        remainingTopicHours -= allocated;
        partIndex += 1;

        weeks.push({
          week: currentWeekNum,
          start: currentWeekStart,
          end: currentWeekEnd,
          hours: Math.round(currentWeekHours * 10) / 10,
          topics: currentWeekTopics,
        });

        currentWeekNum += 1;
        currentWeekStart = addDays(currentWeekEnd, 1);
        currentWeekEnd = addDays(currentWeekStart, 6);
        currentWeekHours = 0;
        currentWeekTopics = [];
      }
    }
  }

  // Push final week
  if (currentWeekTopics.length > 0) {
    weeks.push({
      week: currentWeekNum,
      start: currentWeekStart,
      end: currentWeekEnd,
      hours: Math.round(currentWeekHours * 10) / 10,
      topics: currentWeekTopics,
    });
  }

  const completionDate = weeks[weeks.length - 1]?.end || startDate;
  const totalEffortHours = topics.reduce((acc, t) => acc + t.hours, 0);

  let feasible = true;
  let requiredHoursPerWeek = null;

  if (targetDate) {
    const daysAvailable = daysBetween(startDate, targetDate);
    if (daysAvailable <= 0) {
      feasible = false;
      requiredHoursPerWeek = totalEffortHours;
    } else {
      const weeksAvailable = Math.max(1, daysAvailable / 7);
      feasible = completionDate <= targetDate;
      if (!feasible) {
        requiredHoursPerWeek = Math.round((totalEffortHours / weeksAvailable) * 10) / 10;
      }
    }
  }

  return {
    weeks,
    summary: {
      total_topics: topics.length,
      total_effort_hours: Math.round(totalEffortHours * 10) / 10,
      total_weeks: weeks.length,
      completion_date: completionDate,
      feasible,
      required_hours_per_week: requiredHoursPerWeek,
      pace_factor: 1.0,
      replan_count: 0,
      clustering_method_used: 'llm',
    },
    topic_deadlines: Object.keys(topicDeadlines).map((tid) => ({
      topic_id: tid,
      deadline: topicDeadlines[tid],
    })),
  };
}

module.exports = {
  addDays,
  daysBetween,
  schedulePlan,
};

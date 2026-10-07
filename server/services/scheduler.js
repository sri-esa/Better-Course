/**
 * Calculates study effort taking into account video duration and study intensity
 */
function calculateStudyEffort(totalDurationSeconds, intensity = 'Balanced') {
  const multipliers = {
    Relaxed: 1.25,
    Balanced: 1.5,
    Intensive: 2.0
  };
  const mult = multipliers[intensity] || 1.5;
  const effortSeconds = Math.round(totalDurationSeconds * mult);
  const effortMinutes = Math.round(effortSeconds / 60);
  const effortHours = Math.round((effortSeconds / 3600) * 10) / 10;

  return {
    effort_seconds: effortSeconds,
    effort_minutes: effortMinutes,
    effort_hours: effortHours,
    multiplier: mult
  };
}

/**
 * Calculates weekly schedule deterministically
 */
function calculateSchedule(topics, hoursPerWeek, targetDateStr, intensity = 'Balanced') {
  const now = new Date();
  let targetDate = new Date(targetDateStr);
  if (isNaN(targetDate.getTime())) {
    targetDate = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000); // 6 weeks default
  }

  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weeksAvailable = Math.max(1, Math.ceil(diffDays / 7));

  const totalDuration = topics.reduce((acc, t) => acc + (t.total_duration_seconds || 0), 0);
  const effortData = calculateStudyEffort(totalDuration, intensity);
  const totalEffortHours = effortData.effort_hours;

  const requiredHoursPerWeek = Math.round((totalEffortHours / weeksAvailable) * 10) / 10;
  const isFeasible = hoursPerWeek >= requiredHoursPerWeek;
  const status = isFeasible ? 'FEASIBLE' : `NEEDS ${requiredHoursPerWeek}H/WEEK`;

  const weeklyPlans = [];
  const numTopics = topics.length;

  if (numTopics === 0) {
    return {
      weeks_available: weeksAvailable,
      required_hours_per_week: requiredHoursPerWeek,
      status,
      is_feasible: isFeasible,
      weekly_plans: []
    };
  }

  let currentTopicIdx = 0;
  for (let weekNum = 1; weekNum <= weeksAvailable; weekNum++) {
    if (currentTopicIdx >= numTopics) break;

    const assignedTopic = topics[currentTopicIdx];
    currentTopicIdx++;

    const deadlineDate = new Date(now.getTime() + weekNum * 7 * 24 * 60 * 60 * 1000);
    const deadlineFormatted = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    weeklyPlans.push({
      id: weekNum,
      week_number: weekNum,
      topic_id: assignedTopic.id,
      topic_name: assignedTopic.name,
      difficulty: assignedTopic.difficulty,
      deadline: deadlineFormatted,
      estimated_minutes: assignedTopic.estimated_effort_minutes || 0
    });
  }

  // If there are still topics left, cluster them into the last week
  while (currentTopicIdx < numTopics) {
    const assignedTopic = topics[currentTopicIdx];
    const lastWeek = weeklyPlans.length || 1;
    const deadlineDate = new Date(now.getTime() + lastWeek * 7 * 24 * 60 * 60 * 1000);
    const deadlineFormatted = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    weeklyPlans.push({
      id: weeklyPlans.length + 1,
      week_number: lastWeek,
      topic_id: assignedTopic.id,
      topic_name: assignedTopic.name,
      difficulty: assignedTopic.difficulty,
      deadline: deadlineFormatted,
      estimated_minutes: assignedTopic.estimated_effort_minutes || 0
    });
    currentTopicIdx++;
  }

  return {
    weeks_available: weeksAvailable,
    required_hours_per_week: requiredHoursPerWeek,
    status,
    is_feasible: isFeasible,
    weekly_plans: weeklyPlans
  };
}

module.exports = {
  calculateStudyEffort,
  calculateSchedule
};

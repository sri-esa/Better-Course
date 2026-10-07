import { generateStudyPlan } from './scheduler'
import { formatDate, todayISO } from './format'

// Glue between topic data and the screens.
// 1. runs the FRONTEND scheduler (scheduler.js)
// 2. converts its output into the plan object that PlanPage / DashboardPage read
// It does not schedule anything itself.
//
// Each topic must have: id, name, effort_hours, and `videos`
// ([{ id, title, durationMinutes }]) so the plan page can show the checkboxes.
export function buildPlan({
  title = 'Your study plan',
  playlistUrls = [],
  topics,
  hoursPerWeek,
  targetDate = null,
  today = todayISO(),
}) {
  const schedule = generateStudyPlan(topics, {
    hours_per_week: hoursPerWeek,
    start_date: today,
    target_date: targetDate || null,
  })

  const weeks = schedule.weeks.map((w) => ({
    weekNumber: w.week,
    startDate: w.start,
    endDate: w.end,
    hours: w.hours,
    topics: w.topics.map((t) => ({ ...t, videos: t.videos || [] })),
  }))

  let warning = null
  if (!schedule.feasible) {
    warning =
      `Your target date (${formatDate(schedule.target_date)}) is too soon for ${hoursPerWeek} hrs/week. ` +
      `To finish everything by then you would need about ${schedule.required_hours_per_week} hrs/week. ` +
      `The plan below is packed to fit the date. Choose a later date or more weekly hours for a lighter plan.`
  }

  return {
    title,
    playlistUrls,
    hoursPerWeek,
    targetDate: schedule.target_date,
    startDate: schedule.start_date,
    endDate: schedule.completion_date,
    feasible: schedule.feasible,
    requiredHoursPerWeek: schedule.required_hours_per_week,
    warning,
    weeks,
  }
}
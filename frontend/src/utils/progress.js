import { todayISO } from './format'

export function getWeekVideos(week) {
  return week.topics.flatMap((t) => t.videos)
}

export function getAllVideos(plan) {
  return plan.weeks.flatMap(getWeekVideos)
}

// Progress is weighted by video duration.
export function calcProgress(videos, completed) {
  const set = new Set(completed)
  let totalMinutes = 0
  let doneMinutes = 0
  let doneCount = 0
  for (const v of videos) {
    totalMinutes += v.durationMinutes
    if (set.has(v.id)) {
      doneMinutes += v.durationMinutes
      doneCount += 1
    }
  }
  return {
    totalCount: videos.length,
    doneCount,
    totalMinutes,
    doneMinutes,
    remainingMinutes: totalMinutes - doneMinutes,
    percent: totalMinutes === 0 ? 0 : Math.round((doneMinutes / totalMinutes) * 100),
  }
}

export function getCurrentWeek(plan) {
  const today = todayISO()
  const found = plan.weeks.find((w) => today >= w.startDate && today <= w.endDate)
  if (found) return found
  if (today < plan.weeks[0].startDate) return plan.weeks[0]
  return plan.weeks[plan.weeks.length - 1]
}

// Behind = at least one topic is past its deadline with unfinished videos.
export function getStatus(plan, completed) {
  const today = todayISO()
  const set = new Set(completed)
  const overdueTopics = plan.weeks
    .flatMap((w) => w.topics)
    .filter((t) => t.deadline < today && t.videos.some((v) => !set.has(v.id)))
  return { isBehind: overdueTopics.length > 0, overdueTopics }
}

export function getUpcomingTopics(plan, completed, limit = 5) {
  const set = new Set(completed)
  return plan.weeks
    .flatMap((w) => w.topics.map((t) => ({ ...t, weekNumber: w.weekNumber })))
    .filter((t) => t.videos.some((v) => !set.has(v.id)))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, limit)
}
// Last deadline in the plan. Works for old saved plans too.
export function getPlanEndDate(plan) {
  const deadlines = plan.weeks.flatMap((w) =>
    w.topics.map((t) => t.deadline)
  )

  return deadlines.reduce((a, b) => (a > b ? a : b))
}
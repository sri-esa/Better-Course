// =============================================================================
// scheduler.js - Syllabify's study scheduler (runs entirely in the frontend)
// =============================================================================
//
// generateStudyPlan(topics, constraints) is a PURE function:
//   - no React, no localStorage, no network, no "today" lookup
//   - it never modifies its inputs
//   - same inputs always give the same plan
//
// INPUT
//   topics:      ordered array. Each topic needs  { id, name, effort_hours }.
//                Any other fields (video_ids, videos, difficulty, ...) are kept
//                untouched on the output topics.
//   constraints: { hours_per_week, start_date, target_date? }   dates: "YYYY-MM-DD"
//
// OUTPUT
//   {
//     weeks: [{ week, start, end, topics: [{...topic, deadline}], hours }],
//     completion_date,            // deadline of the last topic
//     feasible,                   // false if target_date cannot be met at hours_per_week
//     required_hours_per_week,    // weekly hours needed to meet target_date
//     ...extra info the UI can use to explain the result (see the end of the file)
//   }
//
// ALGORITHM
//   Step 1  PACE PLAN. Walk the topics in their original order and fill each week
//           with topics until adding the next one would exceed hours_per_week,
//           then start a new week. A topic is never split across weeks, unless it
//           is bigger than one week's capacity: then it gets its own "long week"
//           covering as many whole weeks as it needs.
//           Inside a week, each topic's deadline is placed in proportion to how
//           much of the week's hours are used up once that topic is done.
//   Step 2  TARGET CHECK (only if target_date is given). If the pace plan already
//           finishes on or before target_date, it is used as it is.
//   Step 3  COMPRESSED PLAN. Otherwise the target date cannot be met at the pace
//           the student asked for. We never run past the target date, so ALL topics
//           are spread across the days from start_date to target_date (both
//           inclusive), in proportion to their effort. The last topic is due on the
//           target date. required_hours_per_week tells the UI how much more time
//           per week the student would really need.
//
// DATES
//   All date maths uses UTC calendar days (Date.UTC), never the local time zone,
//   so daylight-saving changes and the user's time zone cannot cause off-by-one
//   errors. Month and year boundaries are handled by the Date object itself.
// =============================================================================

const MS_PER_DAY = 86400000
const EPS = 1e-9 // tolerance for decimal rounding (e.g. 0.1 + 0.2)

// ---------- date helpers (UTC only) ----------

function parseISO(iso, label) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso))
  if (!m) throw new Error(`${label} must be a date in YYYY-MM-DD format.`)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const ms = Date.UTC(y, mo - 1, d)
  const check = new Date(ms)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`${label} is not a real calendar date.`)
  }
  return ms
}

function msToISO(ms) {
  const dt = new Date(ms)
  const y = String(dt.getUTCFullYear()).padStart(4, '0')
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(iso, n) {
  return msToISO(parseISO(iso, 'date') + n * MS_PER_DAY)
}

function daysBetween(fromIso, toIso) {
  return Math.round((parseISO(toIso, 'date') - parseISO(fromIso, 'date')) / MS_PER_DAY)
}

// ---------- small number helpers ----------

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round2 = (n) => Math.round(n * 100) / 100
const ceilTo1 = (n) => Math.ceil(n * 10 - EPS) / 10
const effortOf = (topic) => Number(topic.effort_hours)

// ---------- input checks ----------

function validate(topics, constraints) {
  if (!Array.isArray(topics) || topics.length === 0) {
    throw new Error('There are no topics to schedule.')
  }
  if (!constraints || typeof constraints !== 'object') {
    throw new Error('Scheduling constraints are missing.')
  }

  const hoursPerWeek = Number(constraints.hours_per_week)
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek <= 0) {
    throw new Error('hours_per_week must be a number greater than 0.')
  }

  topics.forEach((t, i) => {
    const e = effortOf(t)
    if (!Number.isFinite(e) || e < 0) {
      throw new Error(`Topic ${i + 1} ("${t && t.name}") needs a valid effort_hours number.`)
    }
  })
  const totalHours = topics.reduce((sum, t) => sum + effortOf(t), 0)
  if (totalHours <= 0) throw new Error('The topics have no study effort to schedule.')

  const start = constraints.start_date
  parseISO(start, 'start_date')

  const target = constraints.target_date || null
  if (target) {
    parseISO(target, 'target_date')
    if (daysBetween(start, target) < 0) {
      throw new Error('The target date must be today or a future date.')
    }
  }

  return { hoursPerWeek, totalHours, start, target }
}

// ---------- Step 1: pace plan ----------

function packByPace(topics, hoursPerWeek, start) {
  // 1a. Group consecutive topics into weeks without exceeding hoursPerWeek.
  const groups = []
  let current = null
  for (const topic of topics) {
    const e = effortOf(topic)
    const fitsInCurrentWeek = current && (current.used === 0 || current.used + e <= hoursPerWeek + EPS)
    if (!fitsInCurrentWeek) {
      current = { used: 0, items: [] }
      groups.push(current)
    }
    current.used += e
    current.items.push({ topic, cumulative: current.used })
  }

  // 1b. Turn each group into a week with dates and per-topic deadlines.
  const weeks = []
  let dayOffset = 0 // days from start_date to the beginning of this group
  for (const group of groups) {
    // A normal group spans 1 week. A single topic larger than one week's hours
    // spans as many whole weeks as it needs ("long week").
    const spanWeeks = Math.max(1, Math.ceil(group.used / hoursPerWeek - EPS))
    const spanDays = spanWeeks * 7
    const capacity = hoursPerWeek * spanWeeks // always >= group.used
    const weekStart = addDays(start, dayOffset)

    const weekTopics = group.items.map(({ topic, cumulative }) => {
      // Deadline = the day of the week by which this share of the week's hours is done.
      const dayIndex = clamp(Math.ceil((cumulative * spanDays) / capacity - EPS) - 1, 0, spanDays - 1)
      return { ...topic, deadline: addDays(weekStart, dayIndex) }
    })

    weeks.push({
      week: weeks.length + 1,
      start: weekStart,
      end: addDays(weekStart, spanDays - 1),
      topics: weekTopics,
      hours: round2(group.used),
    })
    dayOffset += spanDays
  }
  return weeks
}

// ---------- Step 3: compressed plan (used only when the target is too soon) ----------

function packIntoWindow(topics, totalHours, start, totalDays) {
  // Each topic is due on the day matching its cumulative share of the total effort.
  // The last topic has a share of 100%, so it lands exactly on the target date.
  let cumulative = 0
  const placed = topics.map((topic) => {
    cumulative += effortOf(topic)
    const dayIndex = clamp(Math.ceil((cumulative * totalDays) / totalHours - EPS) - 1, 0, totalDays - 1)
    return { topic, dayIndex }
  })

  // Group the topics into calendar weeks (7-day blocks counted from start_date).
  // The last block may be shorter: it stops on the target date.
  const weeks = []
  const blockCount = Math.ceil(totalDays / 7)
  for (let i = 0; i < blockCount; i++) {
    const firstDay = i * 7
    const lastDay = Math.min(i * 7 + 6, totalDays - 1)
    const items = placed.filter((p) => p.dayIndex >= firstDay && p.dayIndex <= lastDay)
    if (items.length === 0) continue // skip weeks that have nothing due

    weeks.push({
      week: weeks.length + 1,
      start: addDays(start, firstDay),
      end: addDays(start, lastDay),
      topics: items.map((p) => ({ ...p.topic, deadline: addDays(start, p.dayIndex) })),
      hours: round2(items.reduce((sum, p) => sum + effortOf(p.topic), 0)),
    })
  }
  return weeks
}

const lastDeadline = (weeks) => {
  const lastWeek = weeks[weeks.length - 1]
  return lastWeek.topics[lastWeek.topics.length - 1].deadline
}

// ---------- public function ----------

export function generateStudyPlan(topics, constraints) {
  const { hoursPerWeek, totalHours, start, target } = validate(topics, constraints)

  // Step 1: the plan at the student's own pace.
  let weeks = packByPace(topics, hoursPerWeek, start)
  let mode = 'pace'
  let feasible = true
  let requiredHoursPerWeek = hoursPerWeek // with no target date, nothing more is required

  let availableWeeks = null
  let availableHours = null
  let shortfallHours = 0

  if (target) {
    const totalDays = daysBetween(start, target) + 1 // inclusive: start day and target day both count
    const requiredRaw = (totalHours * 7) / totalDays // hours per week needed to fit by the target
    requiredHoursPerWeek = ceilTo1(requiredRaw)
    availableWeeks = Math.ceil(totalDays / 7)
    availableHours = round2((hoursPerWeek * totalDays) / 7)

    if (lastDeadline(weeks) > target) {
      // Step 3: cannot finish by the target at this pace -> squeeze everything in before it.
      weeks = packIntoWindow(topics, totalHours, start, totalDays)
      mode = 'compressed'
      // Feasible only if the student has enough weekly hours overall. If not,
      // the UI should show a warning (see shortfall_hours / required_hours_per_week).
      feasible = requiredRaw <= hoursPerWeek + EPS
      shortfallHours = round2(Math.max(0, totalHours - (hoursPerWeek * totalDays) / 7))
    } else {
      // Step 2: pace plan already fits. Just make sure no week is shown past the target.
      weeks = weeks.map((w) => ({ ...w, end: w.end > target ? target : w.end }))
    }
  }

  return {
    weeks,
    completion_date: lastDeadline(weeks),
    feasible,
    required_hours_per_week: requiredHoursPerWeek,

    // Extra information so the UI can explain the result:
    mode, // 'pace' = at the student's hours/week, 'compressed' = squeezed before the target
    total_hours: round2(totalHours),
    hours_per_week: hoursPerWeek,
    start_date: start,
    target_date: target,
    available_weeks: availableWeeks, // null when there is no target date
    available_hours: availableHours, // hours the student has before the target (null if none)
    shortfall_hours: shortfallHours, // hours missing to meet the target (0 if feasible)
  }
}
// Run with:  node scripts/check-scheduler.mjs
// Checks the frontend scheduler (src/utils/scheduler.js) with plain Node. No extra tools needed.
import assert from 'node:assert/strict'
import { generateStudyPlan } from '../src/utils/scheduler.js'

const topics = [
  { id: 1, name: 'Arrays & Strings', effort_hours: 6.5, video_ids: ['a1', 'a2'] },
  { id: 2, name: 'Recursion', effort_hours: 3, video_ids: ['b1'] },
  { id: 3, name: 'Linked Lists', effort_hours: 4, video_ids: ['c1', 'c2'] },
  { id: 4, name: 'Trees', effort_hours: 5.5, video_ids: ['d1'] },
]
const allDeadlines = (p) => p.weeks.flatMap((w) => w.topics.map((t) => t.deadline))
const allIds = (p) => p.weeks.flatMap((w) => w.topics.map((t) => t.id))
let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('ok  -', name) }

test('no target date: pace plan, respects hours/week, keeps all topics in order', () => {
  const p = generateStudyPlan(topics, { hours_per_week: 8, start_date: '2026-10-12' })
  assert.equal(p.feasible, true)
  assert.equal(p.mode, 'pace')
  assert.deepEqual(allIds(p), [1, 2, 3, 4])
  assert.ok(p.weeks.every((w) => w.hours <= 8))
  assert.equal(p.weeks[0].start, '2026-10-12')
  assert.equal(p.completion_date, allDeadlines(p).at(-1))
  assert.equal(p.required_hours_per_week, 8)
  assert.deepEqual(p.weeks[0].topics[0].video_ids, ['a1', 'a2']) // extra fields preserved
})

test('far target date: feasible, finishes on or before the target', () => {
  const p = generateStudyPlan(topics, { hours_per_week: 8, start_date: '2026-10-12', target_date: '2026-12-20' })
  assert.equal(p.feasible, true)
  assert.ok(p.completion_date <= '2026-12-20')
  assert.ok(p.weeks.every((w) => w.end <= '2026-12-20'))
  assert.equal(p.available_weeks, 10)
})

test('target too soon: infeasible, still scheduled, nothing after the target', () => {
  const p = generateStudyPlan(topics, { hours_per_week: 8, start_date: '2026-10-12', target_date: '2026-10-16' })
  assert.equal(p.feasible, false)
  assert.equal(p.mode, 'compressed')
  assert.equal(p.completion_date, '2026-10-16') // last topic due on the target date (inclusive)
  assert.ok(allDeadlines(p).every((d) => d <= '2026-10-16'))
  assert.ok(p.weeks.every((w) => w.end <= '2026-10-16' && w.start <= '2026-10-16'))
  assert.deepEqual(allIds(p), [1, 2, 3, 4])
  assert.equal(p.required_hours_per_week, 26.6) // 19h over 5 days = 26.6 h/week
  assert.ok(p.shortfall_hours > 0)
})

test('target on the start day: everything due that day', () => {
  const p = generateStudyPlan(topics, { hours_per_week: 8, start_date: '2026-10-12', target_date: '2026-10-12' })
  assert.equal(p.completion_date, '2026-10-12')
  assert.equal(p.weeks.length, 1)
  assert.equal(p.feasible, false)
})

test('month and year boundaries', () => {
  const a = generateStudyPlan(topics, { hours_per_week: 8, start_date: '2026-10-28', target_date: '2026-11-05' })
  assert.ok(a.completion_date <= '2026-11-05')
  const b = generateStudyPlan(topics, { hours_per_week: 2, start_date: '2026-12-29', target_date: '2027-01-08' })
  assert.equal(b.completion_date, '2027-01-08')
  assert.ok(allDeadlines(b).every((d) => d <= '2027-01-08'))
  const c = generateStudyPlan(topics, { hours_per_week: 8, start_date: '2028-02-27' }) // leap year
  assert.ok(c.weeks.some((w) => w.start === '2028-02-27' || w.start === '2028-03-05'))
})

test('topic bigger than one week gets a long week', () => {
  const p = generateStudyPlan(
    [{ id: 'x', name: 'Huge', effort_hours: 20 }, { id: 'y', name: 'Small', effort_hours: 2 }],
    { hours_per_week: 8, start_date: '2026-10-12' }
  )
  assert.equal(p.weeks[0].start, '2026-10-12')
  assert.equal(p.weeks[0].end, '2026-11-01') // 3 weeks
  assert.equal(p.weeks[0].topics[0].deadline, '2026-10-29') // 20h at 8h/week = 2.5 weeks
  assert.equal(p.weeks[1].start, '2026-11-02')
})

test('input is not modified, works for any topics', () => {
  const frozen = Object.freeze(topics.map((t) => Object.freeze({ ...t })))
  const p = generateStudyPlan(frozen, { hours_per_week: 3, start_date: '2026-01-01' })
  assert.equal(allIds(p).length, 4)
  assert.equal('deadline' in topics[0], false)
  assert.deepEqual(p, generateStudyPlan(frozen, { hours_per_week: 3, start_date: '2026-01-01' })) // pure
  const one = generateStudyPlan([{ id: 'only', name: 'One', effort_hours: 1 }], { hours_per_week: 5, start_date: '2026-06-01' })
  assert.equal(one.weeks.length, 1)
})

test('bad input gives clear errors', () => {
  const ok = { hours_per_week: 8, start_date: '2026-10-12' }
  assert.throws(() => generateStudyPlan([], ok), /no topics/)
  assert.throws(() => generateStudyPlan(topics, { ...ok, hours_per_week: 0 }), /hours_per_week/)
  assert.throws(() => generateStudyPlan(topics, { ...ok, start_date: '12-10-2026' }), /start_date/)
  assert.throws(() => generateStudyPlan(topics, { ...ok, target_date: '2026-10-11' }), /target date/)
  assert.throws(() => generateStudyPlan(topics, { ...ok, target_date: '2026-02-30' }), /real calendar date/)
  assert.throws(() => generateStudyPlan([{ id: 1, name: 'x' }], ok), /effort_hours/)
})

console.log(`\nAll ${passed} scheduler checks passed.`)
import { useState } from 'react'
import { usePlan } from '../context/PlanContext'
import EmptyState from '../components/EmptyState'
import ProgressBar from '../components/ProgressBar'
import {
  calcProgress,
  getAllVideos,
  getPlanEndDate,
  getStatus,
  getWeekVideos,
} from '../utils/progress'
import { formatDate, formatMinutes } from '../utils/format'

const difficultyStyle = {
  Easy: 'bg-green-100 text-green-700',
  Medium: 'bg-amber-100 text-amber-700',
  Hard: 'bg-red-100 text-red-700',
}

export default function PlanPage() {
  const { plan, completed, toggleVideo, triggerReplan } = usePlan()
  const [showReplanModal, setShowReplanModal] = useState(false)
  const [replanHours, setReplanHours] = useState('')
  const [replanTarget, setReplanTarget] = useState('')
  const [adaptivePace, setAdaptivePace] = useState(true)
  const [replanLoading, setReplanLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  if (!plan) return <EmptyState />

  const done = new Set(completed)
  const overall = calcProgress(getAllVideos(plan), completed)
  const { isBehind } = getStatus(plan, completed)

  function showToast(msg) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  async function handleApplyRequiredHours() {
    if (!plan.requiredHoursPerWeek) return
    setReplanLoading(true)
    try {
      await triggerReplan({ hours_per_week: plan.requiredHoursPerWeek })
      showToast(`Updated schedule to ${plan.requiredHoursPerWeek} hrs/week.`)
    } catch (err) {
      alert(err.message || 'Failed to update schedule')
    } finally {
      setReplanLoading(false)
    }
  }

  async function handleReplanSubmit(e) {
    e.preventDefault()
    setReplanLoading(true)
    try {
      const options = {
        adaptive_pace: adaptivePace,
      }
      if (replanHours) options.hours_per_week = Number(replanHours)
      if (replanTarget) options.target_date = replanTarget

      const updated = await triggerReplan(options)
      setShowReplanModal(false)
      showToast(
        updated?.paceFactor && updated.paceFactor !== 1.0
          ? `Re-planned! Pace factor adjusted to ${updated.paceFactor}x based on your past speed.`
          : 'Re-planned remaining videos starting from today.'
      )
    } catch (err) {
      alert(err.message || 'Failed to replan')
    } finally {
      setReplanLoading(false)
    }
  }

  function markWeekDone(week) {
    const vids = getWeekVideos(week)
    vids.forEach((v) => {
      if (!done.has(v.id)) {
        toggleVideo(v.id)
      }
    })
  }

  return (
    <div>
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all">
          {toastMessage}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{plan.title}</h1>
          <p className="text-slate-600 text-sm mt-1">
            {plan.hoursPerWeek} hrs/week ·{' '}
            {plan.targetDate
              ? `Finish by ${formatDate(plan.targetDate)}`
              : `Estimated finish ${formatDate(getPlanEndDate(plan))}`}
          </p>
        </div>
        <button
          onClick={() => {
            setReplanHours(String(plan.hoursPerWeek || ''))
            setReplanTarget(plan.targetDate || '')
            setShowReplanModal(true)
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
        >
          Re-plan schedule
        </button>
      </div>

      {/* Feasibility Banner */}
      {plan.feasible === false && plan.requiredHoursPerWeek && (
        <div
          className="mt-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <div>
            <strong>Pacing Notice:</strong> To finish by {formatDate(plan.targetDate)} you would need
            about <strong>{plan.requiredHoursPerWeek} hrs/week</strong>.
          </div>
          <button
            onClick={handleApplyRequiredHours}
            disabled={replanLoading}
            className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            Apply ({plan.requiredHoursPerWeek}h)
          </button>
        </div>
      )}

      {/* Behind schedule banner */}
      {isBehind && overall.percent < 100 && (
        <div
          className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <div>You're a bit behind schedule. Would you like to re-plan the remaining videos?</div>
          <button
            onClick={() => {
              setReplanHours(String(plan.hoursPerWeek || ''))
              setReplanTarget(plan.targetDate || '')
              setShowReplanModal(true)
            }}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
          >
            Re-plan from today
          </button>
        </div>
      )}

      {plan.warning && !plan.requiredHoursPerWeek && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3" role="alert">
          {plan.warning}
        </div>
      )}

      <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Overall progress</span>
          <span>{overall.percent}%</span>
        </div>
        <ProgressBar percent={overall.percent} />
      </div>

      <div className="mt-6 space-y-6">
        {plan.weeks.map((week) => {
          const wp = calcProgress(getWeekVideos(week), completed)
          return (
            <section key={week.weekNumber} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">Week {week.weekNumber}</h2>
                    <span className="text-xs text-slate-500">
                      {formatDate(week.startDate)} – {formatDate(week.endDate)}
                    </span>
                  </div>
                  {wp.percent < 100 && (
                    <button
                      onClick={() => markWeekDone(week)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      Mark week done
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <ProgressBar percent={wp.percent} />
                  <span className="text-xs text-slate-600 w-9 text-right font-medium">{wp.percent}%</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {week.topics.map((topic) => {
                  const tp = calcProgress(topic.videos, completed)
                  return (
                    <div key={topic.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-slate-900">{topic.name}</h3>
                        {topic.total_parts > 1 && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                            Part {topic.part} of {topic.total_parts}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyStyle[topic.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                          {topic.difficulty}
                        </span>
                        <span className="text-xs text-slate-500 ml-auto">
                          Due {formatDate(topic.deadline)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {tp.doneCount}/{tp.totalCount} videos · {formatMinutes(tp.totalMinutes)} · {tp.percent}% done
                      </p>

                      <div className="mt-2 space-y-1">
                        {topic.videos.map((video) => {
                          const checked = done.has(video.id)
                          return (
                            <div key={video.id} className="flex items-center justify-between py-1.5 gap-3 hover:bg-slate-50/50 rounded-lg px-1 transition-colors">
                              <label className="flex items-start gap-3 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleVideo(video.id)}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-indigo-600 cursor-pointer"
                                />
                                <span className={`text-sm ${checked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                  {video.title}
                                </span>
                              </label>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-slate-400">
                                  {formatMinutes(video.durationMinutes)}
                                </span>
                                <a
                                  href={`https://www.youtube.com/watch?v=${video.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Watch on YouTube"
                                  className="text-slate-400 hover:text-red-600 text-xs transition-colors"
                                >
                                  ▶
                                </a>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* Re-plan Modal */}
      {showReplanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Re-plan Study Schedule</h3>
            <p className="text-xs text-slate-500 mt-1">
              Adjust your schedule to repack remaining uncompleted videos starting from today.
            </p>

            <form onSubmit={handleReplanSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="replan-hpw">
                  Weekly Study Hours
                </label>
                <input
                  id="replan-hpw"
                  type="number"
                  min="0.5"
                  max="120"
                  step="0.5"
                  value={replanHours}
                  onChange={(e) => setReplanHours(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="replan-target">
                  Target Completion Date (Optional)
                </label>
                <input
                  id="replan-target"
                  type="date"
                  value={replanTarget}
                  onChange={(e) => setReplanTarget(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="replan-adaptive"
                  type="checkbox"
                  checked={adaptivePace}
                  onChange={(e) => setAdaptivePace(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
                <label htmlFor="replan-adaptive" className="text-xs text-slate-700 cursor-pointer">
                  Adjust for my actual study pace
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReplanModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replanLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                >
                  {replanLoading ? 'Re-planning...' : 'Apply Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
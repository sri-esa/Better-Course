import { usePlan } from '../context/PlanContext'
import EmptyState from '../components/EmptyState'
import ProgressBar from '../components/ProgressBar'
import { calcProgress, getAllVideos, getPlanEndDate, getWeekVideos } from '../utils/progress'
import { formatDate, formatMinutes } from '../utils/format'

const difficultyStyle = {
  Easy: 'bg-green-100 text-green-700',
  Medium: 'bg-amber-100 text-amber-700',
  Hard: 'bg-red-100 text-red-700',
}

export default function PlanPage() {
  const { plan, completed, toggleVideo } = usePlan()
  if (!plan) return <EmptyState />

  const done = new Set(completed)
  const overall = calcProgress(getAllVideos(plan), completed)

  return (
    <div>
      <h1 className="text-2xl font-bold">{plan.title}</h1>
            <p className="text-slate-600 text-sm mt-1">
        {plan.hoursPerWeek} hrs/week ·{' '}
        {plan.targetDate
          ? `Finish by ${formatDate(plan.targetDate)}`
          : `Estimated finish ${formatDate(getPlanEndDate(plan))}`}
      </p>

      {plan.warning && (
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
            <section key={week.weekNumber} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">Week {week.weekNumber}</h2>
                  <span className="text-xs text-slate-500">
                    {formatDate(week.startDate)} – {formatDate(week.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <ProgressBar percent={wp.percent} />
                  <span className="text-xs text-slate-600 w-9 text-right">{wp.percent}%</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {week.topics.map((topic) => {
                  const tp = calcProgress(topic.videos, completed)
                  return (
                    <div key={topic.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{topic.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyStyle[topic.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                          {topic.difficulty}
                        </span>
                        <span className="text-xs text-slate-500 ml-auto">
                          Due {formatDate(topic.deadline)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {tp.doneCount}/{tp.totalCount} videos · {formatMinutes(tp.totalMinutes)} · {tp.percent}% done
                      </p>

                      <div className="mt-2">
                        {topic.videos.map((video) => {
                          const checked = done.has(video.id)
                          return (
                            <label key={video.id} className="flex items-start gap-3 py-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleVideo(video.id)}
                                className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600"
                              />
                              <span className={`flex-1 text-sm ${checked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {video.title}
                              </span>
                              <span className="text-xs text-slate-500 whitespace-nowrap">
                                {formatMinutes(video.durationMinutes)}
                              </span>
                            </label>
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
    </div>
  )
}
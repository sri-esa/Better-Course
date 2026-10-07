import { Link } from 'react-router-dom'
import { usePlan } from '../context/PlanContext'
import EmptyState from '../components/EmptyState'
import ProgressBar from '../components/ProgressBar'
import {
  calcProgress,
  getAllVideos,
  getCurrentWeek,
  getPlanEndDate,
  getStatus,
  getUpcomingTopics,
} from '../utils/progress'
import { formatDate, formatMinutes, todayISO } from '../utils/format'

function Stat({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { plan, completed } = usePlan()
  if (!plan) return <EmptyState />

  const overall = calcProgress(getAllVideos(plan), completed)
  const currentWeek = getCurrentWeek(plan)
  const { isBehind, overdueTopics } = getStatus(plan, completed)
  const upcoming = getUpcomingTopics(plan, completed)
  const today = todayISO()
  const finished = overall.percent === 100

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex justify-between items-baseline mb-2">
          <span className="font-medium">Overall progress</span>
          <span className="text-2xl font-bold text-indigo-600">{overall.percent}%</span>
        </div>
        <ProgressBar percent={overall.percent} className="h-3" />
        <p className="text-sm text-slate-500 mt-2">
          {overall.doneCount} of {overall.totalCount} videos completed
        </p>
      </div>

      <div
        className={`rounded-2xl border p-4 ${
          finished
            ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
            : isBehind
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}
      >
        <p className="font-semibold">
          {finished ? 'All done. Great work!' : isBehind ? 'Behind schedule' : 'On track'}
        </p>
        {isBehind && !finished && (
          <p className="text-sm mt-1">
            Past deadline: {overdueTopics.map((t) => t.name).join(', ')}
          </p>
        )}
      </div>
              {plan.warning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3" role="alert">
          {plan.warning}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Current week" value={`Week ${currentWeek.weekNumber} of ${plan.weeks.length}`} />
        <Stat label="Remaining workload" value={formatMinutes(overall.remainingMinutes)} />
        <Stat label="Videos left" value={overall.totalCount - overall.doneCount} />
                <Stat
          label={plan.targetDate ? 'Target date' : 'Estimated finish'}
          value={formatDate(plan.targetDate || getPlanEndDate(plan))}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="font-semibold mb-3">Upcoming topics</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing left. You finished every topic.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((t) => {
              const tp = calcProgress(t.videos, completed)
              const overdue = t.deadline < today
              return (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      Week {t.weekNumber} · {formatMinutes(tp.remainingMinutes)} left
                    </p>
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
                    {overdue ? 'Overdue · ' : 'Due '}
                    {formatDate(t.deadline)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Link to="/plan" className="inline-block text-indigo-600 font-medium text-sm hover:underline">
        Go to study plan →
      </Link>
    </div>
  )
}
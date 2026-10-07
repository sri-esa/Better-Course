import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generatePlan } from '../api/studyflowApi'
import { usePlan } from '../context/PlanContext'
import { todayISO } from '../utils/format'

function isYouTubeLink(url) {
  const u = url.toLowerCase()
  return u.includes('youtube.com') || u.includes('youtu.be')
}

export default function InputPage() {
  const navigate = useNavigate()
  const { savePlan } = usePlan()

  // A list, so more playlists can be supported later
  const [playlistUrls, setPlaylistUrls] = useState([''])
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const minDate = todayISO()

  function updateUrl(index, value) {
    setPlaylistUrls((urls) => urls.map((u, i) => (i === index ? value : u)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const urls = playlistUrls.map((u) => u.trim()).filter(Boolean)
    if (urls.length === 0) return setError('Please paste a YouTube playlist link.')
    if (!urls.every(isYouTubeLink)) return setError('That does not look like a YouTube link.')

    const hours = Number(hoursPerWeek)
    if (!hours || hours <= 0) return setError('Enter how many hours per week you can study.')

    // Target date is optional. Only check it if the user filled it in.
    if (targetDate && targetDate < minDate) {
      return setError('The target date cannot be in the past.')
    }

    setLoading(true)
    try {
      const plan = await generatePlan({
        playlistUrls: urls,
        hoursPerWeek: hours,
        targetDate: targetDate || null,
      })
      savePlan(plan)
      navigate('/plan')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold">Turn a playlist into a study plan</h1>
      <p className="text-slate-600 mt-2">
        Paste a YouTube study playlist and get a topic-wise weekly plan you can follow.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        {playlistUrls.map((url, i) => (
          <div key={i}>
            <label className="block text-sm font-medium mb-1.5" htmlFor={`url-${i}`}>
              YouTube playlist link
            </label>
            <input
              id={`url-${i}`}
              type="text"
              value={url}
              onChange={(e) => updateUrl(i, e.target.value)}
              placeholder="https://www.youtube.com/playlist?list=..."
              className={inputClass}
              disabled={loading}
            />
          </div>
        ))}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="hours">
              Hours available per week
            </label>
            <input
              id="hours"
              type="number"
              min="1"
              max="100"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(e.target.value)}
              placeholder="e.g. 8"
              className={inputClass}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="date">
              Target completion date{' '}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="date"
              type="date"
              min={minDate}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
              disabled={loading}
            />
            <p className="text-xs text-slate-500 mt-1">
              Leave empty and we'll pick a timeline from your weekly hours.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-medium py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading && (
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          {loading ? 'Building your plan…' : 'Generate study plan'}
        </button>
      </form>
    </div>
  )
}
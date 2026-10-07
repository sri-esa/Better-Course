import { buildSamplePlan } from '../data/samplePlan'
import { todayISO } from '../utils/format'

// Backend API configuration
const API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const USE_MOCK = import.meta.env.VITE_USE_MOCKS === 'true'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function transformBackendPlan(data, playlistUrls) {
  const deadlineMap = {}
  if (Array.isArray(data.topic_deadlines)) {
    data.topic_deadlines.forEach((d) => {
      deadlineMap[d.topic_id] = d.deadline
    })
  }

  const topicMetaMap = {}
  if (Array.isArray(data.topics)) {
    data.topics.forEach((t) => {
      topicMetaMap[t.id] = t
    })
  }

  const weeks = data.weeks.map((w) => ({
    weekNumber: w.week,
    startDate: w.start,
    endDate: w.end,
    hours: w.hours,
    topics: w.topics.map((t) => {
      const meta = topicMetaMap[t.topic_id] || {}
      const diffStr = meta.difficulty || 'intermediate'
      const difficulty =
        diffStr === 'beginner' ? 'Easy' : diffStr === 'advanced' ? 'Hard' : 'Medium'

      return {
        id: t.topic_id,
        name: t.name,
        hours: t.hours,
        difficulty,
        deadline: deadlineMap[t.topic_id] || w.end,
        part: t.part,
        total_parts: t.total_parts,
        videos: (t.videos || []).map((v) => ({
          id: v.youtube_video_id,
          title: v.title,
          durationMinutes: Math.max(1, Math.round((v.duration_seconds || 0) / 60)),
          duration_seconds: v.duration_seconds,
          thumbnail_url: v.thumbnail_url,
          completed: v.completed || false,
        })),
      }
    }),
  }))

  let warning = null
  if (!data.summary?.feasible) {
    warning = `To finish by ${data.settings?.target_date || 'your deadline'}, you would need about ${data.summary?.required_hours_per_week} hrs/week.`
  }

  return {
    id: data.id,
    title: data.playlist?.title || 'Your study plan',
    playlistUrls: playlistUrls || [data.playlist?.youtube_playlist_id || ''],
    hoursPerWeek: data.settings?.hours_per_week,
    startDate: data.settings?.start_date,
    targetDate: data.settings?.target_date,
    endDate: data.summary?.completion_date,
    feasible: data.summary?.feasible,
    requiredHoursPerWeek: data.summary?.required_hours_per_week,
    paceFactor: data.summary?.pace_factor || 1.0,
    replanCount: data.summary?.replan_count || 0,
    clusteringMethodUsed: data.summary?.clustering_method_used || 'llm',
    warning,
    weeks,
    rawBackendData: data,
  }
}

export async function generatePlan({ playlistUrls, hoursPerWeek, targetDate }) {
  if (USE_MOCK) {
    await wait(1500)
    if (playlistUrls.some((u) => u.toLowerCase().includes('fail'))) {
      throw new Error('Could not load this playlist. Please check the link and try again.')
    }
    return buildSamplePlan({ playlistUrls, hoursPerWeek, targetDate })
  }

  const endpoint = `${API_URL}/api/analyze`
  const today = todayISO()
  let response

  try {
    response = await fetch(`${endpoint}?today=${today}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlist_url: playlistUrls[0],
        hours_per_week: hoursPerWeek,
        start_date: today,
        target_date: targetDate || null,
      }),
    })
  } catch {
    // If backend cannot be reached, fallback gracefully to mock mode if desired
    console.warn('Backend /api/analyze unreachable, falling back to mock mode')
    return buildSamplePlan({ playlistUrls, hoursPerWeek, targetDate })
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    const msg = errData?.error?.message || 'The server could not load this playlist. Please try again in a moment.'
    throw new Error(msg)
  }

  const data = await response.json()
  return transformBackendPlan(data, playlistUrls)
}

export async function fetchPlan(planId) {
  if (USE_MOCK || !planId) return null

  const today = todayISO()
  try {
    const res = await fetch(`${API_URL}/api/plans/${planId}?today=${today}`)
    if (!res.ok) return null
    const data = await res.json()
    return transformBackendPlan(data)
  } catch {
    return null
  }
}

export async function updateProgress(planId, updates) {
  if (USE_MOCK || !planId) return null

  const today = todayISO()
  try {
    const res = await fetch(`${API_URL}/api/plans/${planId}/progress?today=${today}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('Failed to sync progress to server:', err)
    return null
  }
}

export async function replanPlan(planId, options = {}) {
  if (USE_MOCK || !planId) return null

  const today = todayISO()
  const res = await fetch(`${API_URL}/api/plans/${planId}/replan?today=${today}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Failed to replan study schedule.')
  }

  const data = await res.json()
  return transformBackendPlan(data)
}
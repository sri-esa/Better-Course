import { buildSamplePlan } from '../data/samplePlan'
import { buildPlan } from '../utils/buildPlan'

// ALL backend calls live in this one file.
//
// The backend supplies TOPIC DATA only (topics, effort, videos).
// The weekly schedule is always created in the frontend (utils/scheduler.js).
//
// Mock mode (default): used while VITE_API_URL is empty. Uses sample topics.
// Real mode: set VITE_API_URL (see .env.example) and the app calls the backend.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const USE_MOCK = !API_URL

// TODO: confirm this path and the JSON shapes with Members 1 and 2 once
// docs/api-contract.md is final. This is the ONLY place that needs to change.
const PLAN_ENDPOINT = '/playlist'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function generatePlan({ playlistUrls, hoursPerWeek, targetDate }) {
  if (USE_MOCK) {
    await wait(1500) // pretend the server is working
    // Test trick: a link containing the word "fail" shows the error state.
    if (playlistUrls.some((u) => u.toLowerCase().includes('fail'))) {
      throw new Error('Could not load this playlist. Please check the link and try again.')
    }
    return buildSamplePlan({ playlistUrls, hoursPerWeek, targetDate })
  }

  let response
  try {
    response = await fetch(`${API_URL}${PLAN_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistUrls }),
    })
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection and try again.')
  }

  if (!response.ok) {
    throw new Error('The server could not load this playlist. Please try again in a moment.')
  }

  // Expected (to confirm in the API contract):
  //   { title, topics: [{ id, name, difficulty, effort_hours, video_ids, videos: [{ id, title, durationMinutes }] }] }
  const data = await response.json()
  if (!data || !Array.isArray(data.topics) || data.topics.length === 0) {
    throw new Error('The server sent a playlist we could not read. Please try again.')
  }

  // The frontend scheduler decides the weekly plan, not the backend.
  return buildPlan({
    title: data.title,
    playlistUrls,
    topics: data.topics,
    hoursPerWeek,
    targetDate,
  })
}
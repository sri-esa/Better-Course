import { createContext, useContext, useEffect, useState } from 'react'
import { replanPlan, updateProgress } from '../api/studyflowApi'

const PlanContext = createContext(null)
const STORAGE_KEY = 'syllabify-state'
const OLD_STORAGE_KEY = 'studyflow-state' // old name, only used to migrate saved data

function loadSaved() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      // One-time migration from the old key
      const old = localStorage.getItem(OLD_STORAGE_KEY)
      if (old !== null) {
        localStorage.setItem(STORAGE_KEY, old)
        localStorage.removeItem(OLD_STORAGE_KEY)
        raw = old
      }
    }
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

export function PlanProvider({ children }) {
  const [plan, setPlan] = useState(() => loadSaved().plan || null)
  const [completed, setCompleted] = useState(() => loadSaved().completed || [])

  // Keep progress after page refresh
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan, completed }))
  }, [plan, completed])

  function savePlan(newPlan) {
    setPlan(newPlan)
    setCompleted([])
  }

  function toggleVideo(id, actualSeconds = null) {
    const isNowDone = !completed.includes(id)
    setCompleted((prev) =>
      isNowDone ? [...prev, id] : prev.filter((x) => x !== id)
    )

    // Optimistically sync to backend if plan exists on server
    if (plan?.id) {
      updateProgress(plan.id, [
        {
          youtube_video_id: id,
          completed: isNowDone,
          actual_seconds: actualSeconds,
        },
      ]).catch((err) => {
        console.error('Progress sync error:', err)
      })
    }
  }

  async function triggerReplan(options = {}) {
    if (!plan?.id) return
    const updated = await replanPlan(plan.id, options)
    setPlan(updated)
    return updated
  }

  return (
    <PlanContext.Provider value={{ plan, completed, savePlan, toggleVideo, triggerReplan }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used inside PlanProvider')
  return ctx
}
import { createContext, useContext, useEffect, useState } from 'react'

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

  function toggleVideo(id) {
    setCompleted((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <PlanContext.Provider value={{ plan, completed, savePlan, toggleVideo }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used inside PlanProvider')
  return ctx
}
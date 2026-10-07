import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import InputPage from './pages/InputPage'
import PlanPage from './pages/PlanPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<InputPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
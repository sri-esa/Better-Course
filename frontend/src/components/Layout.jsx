import { NavLink, Outlet } from 'react-router-dom'

const linkClass = ({ isActive }) =>
  `px-2.5 sm:px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-4xl px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
          <span className="text-lg font-bold text-indigo-600">Syllabify</span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={linkClass}>New plan</NavLink>
            <NavLink to="/plan" className={linkClass}>Plan</NavLink>
            <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
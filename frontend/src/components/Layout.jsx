import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }) =>
  `px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function Layout() {
  const { user, logout, openLogin, openRegister } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-2 font-bold text-lg text-indigo-600">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm shadow-indigo-200">
                S
              </span>
              <span>StudyFlow</span>
            </NavLink>

            <nav className="hidden sm:flex items-center gap-1">
              <NavLink to="/" end className={linkClass}>
                New Plan
              </NavLink>
              <NavLink to="/plan" className={linkClass}>
                Current Plan
              </NavLink>
              <NavLink to="/dashboard" className={linkClass}>
                Dashboard
              </NavLink>
              {user && (
                <NavLink to="/my-courses" className={linkClass}>
                  My Courses
                </NavLink>
              )}
            </nav>
          </div>

          {/* User Auth Controls */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                  />
                  <span className="hidden md:inline text-sm font-medium text-slate-700">
                    {user.name}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openLogin}
                  className="text-sm font-medium text-slate-700 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={openRegister}
                  className="text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg shadow-sm shadow-indigo-100 transition-colors"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="sm:hidden px-4 pb-2.5 pt-1 border-t border-slate-100 flex gap-1 overflow-x-auto">
          <NavLink to="/" end className={linkClass}>
            New Plan
          </NavLink>
          <NavLink to="/plan" className={linkClass}>
            Current Plan
          </NavLink>
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>
          {user && (
            <NavLink to="/my-courses" className={linkClass}>
              My Courses
            </NavLink>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}

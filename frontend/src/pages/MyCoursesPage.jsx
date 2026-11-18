import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Sparkles, Clock, Calendar, ArrowRight, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MyCoursesPage() {
  const { user, token, openLogin } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCourses() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/auth/my-courses`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
        } else {
          setError('Failed to fetch your saved courses.');
        }
      } catch {
        setError('Network error loading courses.');
      } finally {
        setLoading(false);
      }
    }

    loadCourses();
  }, [token]);

  if (!user && !loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 max-w-xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#70e000] mb-6">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="font-editorial text-4xl font-extrabold uppercase text-white tracking-tight">
          SIGN IN TO VIEW SAVED COURSES.
        </h2>
        <p className="text-neutral-400 text-sm mt-3">
          Sign in or create an account to view and track all your AI-generated study playlists.
        </p>
        <button
          onClick={openLogin}
          className="mt-6 px-6 py-3 rounded-full bg-white hover:bg-[#70e000] text-black font-semibold text-xs uppercase tracking-wider transition-all"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-28">
        <div className="inline-block w-8 h-8 border-2 border-[#70e000] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-mono text-neutral-400 mt-4">Loading your enrolled courses...</p>
      </div>
    );
  }

  return (
    <div className="py-12 px-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 pb-8 border-b border-white/10">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-[#70e000] block mb-2">
            LIBRARY
          </span>
          <h1 className="font-editorial text-4xl sm:text-5xl font-extrabold uppercase tracking-tight text-white">
            MY STUDY COURSES.
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            {courses.length} {courses.length === 1 ? 'course' : 'courses'} saved under your account ({user?.email}).
          </p>
        </div>

        <Link
          to="/create"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-white text-black hover:bg-[#70e000] transition-all self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Plan New Course
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm">
          {error}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="text-center py-20 px-6 rounded-3xl bg-[#0f1117] border border-white/10 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#70e000] mx-auto mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-editorial font-bold text-white uppercase">
            No courses in library
          </h3>
          <p className="text-sm text-neutral-400 mt-2 max-w-sm mx-auto">
            You haven't generated any study plans with this account yet. Paste any YouTube playlist to start!
          </p>
          <Link
            to="/create"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#70e000] hover:bg-[#80f000] text-black font-semibold text-xs uppercase tracking-wider transition-all"
          >
            Create Your First Plan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/plan/${course.id}`}
              className="group p-6 rounded-2xl bg-[#0f1117] border border-white/10 hover:border-[#70e000]/50 transition-all flex flex-col justify-between hover:shadow-xl hover:shadow-[#70e000]/5"
            >
              <div>
                {/* Thumbnail */}
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-neutral-900 mb-4 border border-white/5 relative">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono text-white">
                    {course.videoCount} videos
                  </span>
                </div>

                <h3 className="font-editorial text-lg font-bold text-white line-clamp-2 group-hover:text-[#70e000] transition-colors">
                  {course.title}
                </h3>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#70e000]" />
                    {course.hoursPerWeek} hrs/wk
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#70e000]" />
                    {course.targetDate || 'Flexible'}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-neutral-400 mb-1">
                    <span>Progress</span>
                    <span className="text-white">{course.progressPercentage}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#70e000] rounded-full transition-all"
                      style={{ width: `${course.progressPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end text-xs font-mono text-[#70e000] group-hover:translate-x-1 transition-transform pt-1">
                  <span className="flex items-center gap-1">
                    Open Syllabus <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

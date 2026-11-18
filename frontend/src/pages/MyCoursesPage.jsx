import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { fetchPlan } from '../api/studyflowApi';

export default function MyCoursesPage() {
  const { user, token } = useAuth();
  const { savePlan } = usePlan();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCourses() {
      if (!token) return;
      try {
        const res = await fetch('/api/plans/my-courses', {
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

  async function handleOpenCourse(planId) {
    try {
      const fullPlan = await fetchPlan(planId);
      if (fullPlan) {
        savePlan(fullPlan);
        navigate('/plan');
      }
    } catch (err) {
      alert('Could not open this course: ' + err.message);
    }
  }

  async function handleDeleteCourse(planId, e) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this course from your library?')) return;

    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c.id !== planId));
      }
    } catch {
      alert('Failed to delete course.');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 mt-3">Loading your course library...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Course Library</h1>
          <p className="text-slate-500 text-sm mt-1">
            All your AI-generated study playlists linked to your account.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
        >
          + Plan New Course
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl p-8">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            📚
          </div>
          <h3 className="text-lg font-bold text-slate-800">No courses saved yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Paste any YouTube study playlist link to generate your first structured curriculum!
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Create Your First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => handleOpenCourse(course.id)}
              className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-base text-slate-900 line-clamp-2">
                    {course.title}
                  </h3>
                  <button
                    onClick={(e) => handleDeleteCourse(course.id, e)}
                    className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Delete Course"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">{course.channelTitle || 'YouTube Course'}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                  {course.hoursPerWeek} hrs/week
                </span>
                <span>{course.totalWeeks} Weeks</span>
                <span>Due: {course.completionDate || 'Flexible'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

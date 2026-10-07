import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Play
} from 'lucide-react';

export default function DashboardPage() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReplanning, setIsReplanning] = useState(false);
  const [replanSuccess, setReplanSuccess] = useState(false);

  const fetchDashboardPlan = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/plans/latest/current');
      if (!res.ok) {
        throw new Error('No active study plan found.');
      }
      const data = await res.json();
      setPlan(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardPlan();
  }, []);

  const handleReplan = async () => {
    if (!plan) return;
    setIsReplanning(true);
    try {
      const res = await fetch(`/api/plans/${plan.id}/replan`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Replanning failed.');
      const updated = await res.json();
      setPlan(updated);
      setReplanSuccess(true);
      setTimeout(() => setReplanSuccess(false), 5000);
    } catch (err) {
      alert('Replanning failed.');
    } finally {
      setIsReplanning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-[#70e000] rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-neutral-400">Loading your student dashboard...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-4xl font-editorial font-bold text-white mb-3">No Active Plan</h2>
        <p className="text-neutral-400 max-w-md mb-8">
          You haven't generated a study plan yet. Paste any YouTube playlist to start tracking your progress.
        </p>
        <Link
          to="/create"
          className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-[#70e000] transition-colors"
        >
          Create Your First Plan →
        </Link>
      </div>
    );
  }

  // Calculate current week information
  const currentWeekPlan = plan.weekly_plans.length > 0 ? plan.weekly_plans[0] : null;

  return (
    <div className="py-12 px-6 max-w-7xl mx-auto space-y-12">
      
      {/* Replanning Banner */}
      {replanSuccess && (
        <div className="p-4 rounded-xl bg-[#70e000]/15 border border-[#70e000]/30 text-[#70e000] text-sm font-mono flex items-center justify-between">
          <span>Plan updated! Your remaining workload has been redistributed across the next weeks.</span>
          <button onClick={() => setReplanSuccess(false)} className="text-white hover:underline">Dismiss</button>
        </div>
      )}

      {/* Hero Headline */}
      <div>
        <span className="text-xs font-mono uppercase tracking-widest text-[#70e000] block mb-2">
          CONTINUOUS MOMENTUM
        </span>
        <h1 className="font-editorial text-6xl sm:text-7xl md:text-8xl font-extrabold uppercase tracking-tight text-white leading-none">
          KEEP <br />
          MOVING.
        </h1>
      </div>

      {/* Main Progress Bar Visualization Card */}
      <div className="p-8 md:p-10 rounded-3xl border border-white/10 bg-[#0f1117] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
              {plan.playlist_title}
            </div>
            <div className="text-3xl font-editorial font-bold text-white mt-1">
              Overall Progress
            </div>
          </div>

          <div className="text-right">
            <div className="text-4xl font-editorial font-extrabold text-[#70e000]">
              {plan.overall_progress_percentage}%
            </div>
            <div className="text-xs font-mono text-neutral-400">
              {plan.completed_videos} of {plan.total_videos} videos completed
            </div>
          </div>
        </div>

        {/* Large Horizontal Progress Bar */}
        <div className="w-full bg-neutral-900 rounded-full h-4 overflow-hidden border border-white/5">
          <div 
            className="bg-[#70e000] h-4 rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${plan.overall_progress_percentage}%` }}
          />
        </div>
      </div>

      {/* Dashboard KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Current Week */}
        <div className="p-6 rounded-2xl border border-white/10 bg-[#11131a]">
          <span className="text-xs font-mono text-neutral-400 uppercase">Current Schedule</span>
          <div className="text-3xl font-editorial font-extrabold text-white mt-2">
            Week 01
          </div>
          <div className="text-xs font-mono text-neutral-500 mt-1 truncate">
            {currentWeekPlan ? currentWeekPlan.topic_name : 'All caught up'}
          </div>
        </div>

        {/* Card 2: Hours Completed */}
        <div className="p-6 rounded-2xl border border-white/10 bg-[#11131a]">
          <span className="text-xs font-mono text-neutral-400 uppercase">Hours Completed</span>
          <div className="text-3xl font-editorial font-extrabold text-white mt-2">
            {plan.hours_completed}h
          </div>
          <div className="text-xs font-mono text-neutral-500 mt-1">
            Active studying logged
          </div>
        </div>

        {/* Card 3: Hours Remaining */}
        <div className="p-6 rounded-2xl border border-white/10 bg-[#11131a]">
          <span className="text-xs font-mono text-neutral-400 uppercase">Hours Remaining</span>
          <div className="text-3xl font-editorial font-extrabold text-[#70e000] mt-2">
            {plan.hours_remaining}h
          </div>
          <div className="text-xs font-mono text-neutral-500 mt-1">
            Total remaining effort
          </div>
        </div>

        {/* Card 4: Target Date */}
        <div className="p-6 rounded-2xl border border-white/10 bg-[#11131a]">
          <span className="text-xs font-mono text-neutral-400 uppercase">Target Date</span>
          <div className="text-2xl font-editorial font-bold text-white mt-2 truncate">
            {plan.target_date_formatted}
          </div>
          <div className="text-xs font-mono text-neutral-500 mt-1">
            {plan.hours_per_week}h/week allocated
          </div>
        </div>

      </div>


      {/* Current Week Focus + Replanning Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* THIS WEEK FOCUS CARD */}
        <div className="lg:col-span-7 p-8 rounded-3xl border border-white/10 bg-[#0f1117] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#70e000]">
                THIS WEEK
              </span>
              <h2 className="text-2xl font-editorial font-bold text-white mt-1">
                {currentWeekPlan ? `Week 01: ${currentWeekPlan.topic_name}` : 'Curriculum Progress'}
              </h2>
            </div>
            
            <Link
              to={`/plan/${plan.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white text-black hover:bg-[#70e000] transition-colors"
            >
              Continue Studying
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-neutral-300 font-mono flex items-center justify-between">
              <span>Estimated remaining this week:</span>
              <strong className="text-white">
                {currentWeekPlan ? currentWeekPlan.estimated_effort_formatted : '0m'}
              </strong>
            </div>

            {/* Quick list of this week's videos */}
            {currentWeekPlan && (
              <div className="space-y-2 pt-2">
                {currentWeekPlan.videos.slice(0, 4).map((vid) => (
                  <div 
                    key={vid.id}
                    className="p-3 rounded-xl bg-[#141720] border border-white/5 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-2 h-2 rounded-full ${vid.completed ? 'bg-[#70e000]' : 'bg-neutral-600'}`} />
                      <span className={`truncate ${vid.completed ? 'line-through text-neutral-500' : 'text-neutral-300'}`}>
                        {vid.title}
                      </span>
                    </div>
                    <span className="text-neutral-500 shrink-0">{vid.duration_formatted}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PACE STATUS & REPLANNING CARD */}
        <div className="lg:col-span-5 p-8 rounded-3xl border border-white/10 bg-[#0f1117] space-y-6">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              PACING STATUS
            </span>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                plan.is_feasible
                  ? 'bg-[#70e000]/15 text-[#70e000] border-[#70e000]/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                {plan.is_feasible ? 'ON TRACK' : 'NEEDS ADJUSTMENT'}
              </span>
            </div>
          </div>

          <p className="text-sm text-neutral-400 leading-relaxed">
            {plan.is_feasible
              ? `You are on pace to complete the playlist before ${plan.target_date_formatted} with your current ${plan.hours_per_week}h/week dedication.`
              : `To comfortably finish by ${plan.target_date_formatted}, you require approximately ${plan.required_hours_per_week} hours per week.`}
          </p>

          <div className="pt-4 border-t border-white/5">
            <button
              onClick={handleReplan}
              disabled={isReplanning}
              className="w-full py-3.5 rounded-xl border border-white/10 hover:border-[#70e000]/50 bg-white/5 hover:bg-white/10 text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isReplanning ? 'animate-spin text-[#70e000]' : ''}`} />
              {isReplanning ? 'Recalculating...' : 'Replan Remaining Work'}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

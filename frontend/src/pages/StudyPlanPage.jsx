import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  ExternalLink, 
  Clock, 
  Calendar, 
  RotateCcw, 
  Sparkles, 
  ArrowRight,
  BookOpen,
  BarChart3,
  Layers
} from 'lucide-react';

export default function StudyPlanPage() {
  const { playlistId } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReplanning, setIsReplanning] = useState(false);
  const [replanNotification, setReplanNotification] = useState(null);

  // Load study plan data
  const fetchPlan = async () => {
    try {
      setLoading(true);
      const url = playlistId === 'latest' 
        ? '/api/plans/latest/current' 
        : `/api/plans/${playlistId}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Study plan not found. Please create one first!');
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
    fetchPlan();
  }, [playlistId]);

  // Handle toggling video completion status
  const handleToggleVideo = async (videoId, currentCompleted) => {
    // Optimistic UI update
    const updatedPlan = { ...plan };
    let toggled = false;

    // Update in topics and weekly plans
    for (const topic of updatedPlan.topics) {
      for (const vid of topic.videos) {
        if (vid.id === videoId) {
          vid.completed = !currentCompleted;
          toggled = true;
          break;
        }
      }
      if (toggled) break;
    }

    setPlan(updatedPlan);

    try {
      await fetch(`/api/progress/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted })
      });
      // Refresh to keep calculations synced
      const res = await fetch(`/api/plans/${plan.id}`);
      if (res.ok) {
        const fresh = await res.json();
        setPlan(fresh);
      }
    } catch (err) {
      console.error('Failed to toggle video status', err);
    }
  };

  // Automatic Replanning handler
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
      setReplanNotification('Plan updated! Your remaining workload has been redistributed across remaining weeks.');
      setTimeout(() => setReplanNotification(null), 6000);
    } catch (err) {
      alert('Replanning could not be completed.');
    } finally {
      setIsReplanning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-[#70e000] rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-neutral-400">Loading your curriculum...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-3xl font-editorial font-bold text-white mb-3">No Plan Found</h2>
        <p className="text-neutral-400 max-w-md mb-8">{error || 'Create a plan to get started.'}</p>
        <Link
          to="/create"
          className="px-6 py-3 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-[#70e000] transition-colors"
        >
          Create A Study Plan →
        </Link>
      </div>
    );
  }

  return (
    <div className="py-12 px-6 max-w-7xl mx-auto space-y-16">
      
      {/* Replanning Toast notification */}
      {replanNotification && (
        <div className="p-4 rounded-xl bg-[#70e000]/15 border border-[#70e000]/30 text-[#70e000] text-sm font-mono flex items-center justify-between">
          <span>{replanNotification}</span>
          <button onClick={() => setReplanNotification(null)} className="text-white hover:underline">Dismiss</button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOP HEADER / METADATA SECTION */}
      {/* ========================================================= */}
      <div className="p-8 md:p-12 rounded-3xl border border-white/10 bg-[#0f1117] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          
          {/* Playlist Thumbnail */}
          {plan.playlist_thumbnail && (
            <img 
              src={plan.playlist_thumbnail} 
              alt={plan.playlist_title} 
              className="w-32 h-24 sm:w-44 sm:h-28 object-cover rounded-2xl border border-white/10 shadow-md"
            />
          )}

          <div className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#70e000]">
              ACTIVE CURRICULUM
            </span>
            <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              {plan.playlist_title}
            </h1>
            
            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-400 pt-2">
              <span className="text-white font-medium">{plan.total_videos} videos</span>
              <span>•</span>
              <span>{plan.total_duration_formatted} content</span>
              <span>•</span>
              <span>Effort: <strong className="text-white">{plan.estimated_study_effort_hours}h</strong></span>
              <span>•</span>
              <span>Target: <strong className="text-white">{plan.target_date_formatted}</strong></span>
              <span>•</span>
              <span>{plan.hours_per_week}h / week</span>
            </div>
          </div>
        </div>

        {/* Status Pill & Action Buttons */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 w-full lg:w-auto border-t lg:border-t-0 border-white/10 pt-4 lg:pt-0">
          <div className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider border ${
            plan.is_feasible 
              ? 'bg-[#70e000]/15 text-[#70e000] border-[#70e000]/30' 
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          }`}>
            {plan.status}
          </div>

          <button
            onClick={handleReplan}
            disabled={isReplanning}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReplanning ? 'animate-spin' : ''}`} />
            {isReplanning ? 'Recalculating...' : 'Replan Work'}
          </button>
        </div>
      </div>


      {/* ========================================================= */}
      {/* TOPIC CARDS SECTION */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#70e000] block">
              MODULE BREAKDOWN
            </span>
            <h2 className="font-editorial text-3xl md:text-4xl font-bold uppercase text-white">
              Syllabus Topics
            </h2>
          </div>
          <span className="text-xs font-mono text-neutral-500">
            {plan.topics.length} Academic Modules
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plan.topics.map((topic) => (
            <div 
              key={topic.id}
              className="p-6 rounded-2xl border border-white/10 bg-[#11131a] flex flex-col justify-between hover:border-white/20 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md uppercase font-semibold ${
                    topic.difficulty === 'FOUNDATION' 
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                      : topic.difficulty === 'INTERMEDIATE'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                  }`}>
                    {topic.difficulty}
                  </span>
                  <span className="text-xs font-mono text-neutral-500">
                    Topic 0{topic.order_number}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                  {topic.name}
                </h3>

                <div className="text-xs font-mono text-neutral-400 space-y-1 mt-4">
                  <div>{topic.video_count} videos ({topic.total_duration_formatted} watch)</div>
                  <div>Estimated study effort: <strong className="text-white">{topic.estimated_effort_formatted}</strong></div>
                </div>
              </div>

              {/* Progress per topic */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <div className="flex justify-between text-xs font-mono text-neutral-400 mb-1.5">
                  <span>Completed</span>
                  <span className="text-white">{topic.completion_percentage}% ({topic.completed_video_count}/{topic.video_count})</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-[#70e000] h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${topic.completion_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* ========================================================= */}
      {/* VERTICAL WEEKLY TIMELINE */}
      {/* ========================================================= */}
      <div>
        <div className="mb-8">
          <span className="text-xs font-mono uppercase tracking-widest text-[#70e000] block">
            WEEKLY SCHEDULE
          </span>
          <h2 className="font-editorial text-3xl md:text-4xl font-bold uppercase text-white">
            Study Timeline
          </h2>
        </div>

        <div className="space-y-10 relative before:absolute before:inset-0 before:left-4 md:before:left-8 before:w-px before:bg-white/10">
          {plan.weekly_plans.map((week) => (
            <div key={week.id} className="relative pl-10 md:pl-20">
              
              {/* Timeline marker circle */}
              <div className="absolute left-2.5 md:left-6.5 top-1.5 w-3.5 h-3.5 rounded-full bg-[#70e000] border-4 border-[#090a0f] ring-2 ring-white/10" />

              {/* Week Card */}
              <div className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[#0f1117] hover:border-white/20 transition-all">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-[#70e000]">
                      WEEK {week.week_number < 10 ? `0${week.week_number}` : week.week_number}
                    </span>
                    <h3 className="text-2xl font-editorial font-bold text-white mt-1">
                      {week.topic_name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-6 text-xs font-mono text-neutral-400">
                    <div>
                      Deadline: <span className="text-white font-bold">{week.deadline}</span>
                    </div>
                    <div>
                      Est. Effort: <span className="text-[#70e000] font-bold">{week.estimated_effort_formatted}</span>
                    </div>
                  </div>
                </div>

                {/* Videos list under this topic */}
                <div className="mt-6 space-y-3">
                  {week.videos.map((vid) => (
                    <div 
                      key={vid.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                        vid.completed 
                          ? 'bg-neutral-900/40 border-white/5 text-neutral-500' 
                          : 'bg-[#151821] border-white/5 text-neutral-200 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleVideo(vid.id, vid.completed)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            vid.completed 
                              ? 'bg-[#70e000] border-[#70e000] text-black' 
                              : 'border-white/20 hover:border-[#70e000]'
                          }`}
                        >
                          {vid.completed && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <span className={`text-sm font-medium truncate ${vid.completed ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>
                          {vid.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 font-mono text-xs text-neutral-400">
                        <span>{vid.duration_formatted}</span>
                        <a
                          href={`https://www.youtube.com/watch?v=${vid.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                          title="Open on YouTube"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

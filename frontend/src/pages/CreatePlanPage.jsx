import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle, ArrowRight, CheckCircle2, Clock, Calendar, Zap } from 'lucide-react';

export default function CreatePlanPage() {
  const navigate = useNavigate();

  // Simple, standard React state (student-friendly, no Redux or complicated hooks)
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState(8);
  
  // Default target date: 6 weeks from today
  const defaultTarget = new Date();
  defaultTarget.setDate(defaultTarget.getDate() + 42);
  const formattedDefaultDate = defaultTarget.toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(formattedDefaultDate);

  const [intensity, setIntensity] = useState('Balanced');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);

  // Progressive loading steps specified in requirements
  const loadingSteps = [
    'Fetching playlist videos...',
    'Reading video durations...',
    'Grouping related topics...',
    'Estimating study effort...',
    'Building your schedule...'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!playlistUrl.trim()) {
      setError('Please paste a YouTube playlist link or choose a demo course.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingStep(0);

    // Timed frontend state progression for rich feedback
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 700);

    try {
      const response = await fetch('/api/playlists/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playlist_url: playlistUrl,
          hours_per_week: Number(hoursPerWeek),
          target_date: targetDate,
          study_intensity: intensity,
        }),
      });

      clearInterval(interval);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to analyze playlist. Please verify the URL or try again.');
      }

      const planData = await response.json();
      // Navigate to the created study plan
      navigate(`/plan/${planData.id}`);
    } catch (err) {
      clearInterval(interval);
      setIsLoading(false);
      setError(err.message || 'We could not reach YouTube right now. Please try again.');
    }
  };

  const handleDemoSelect = (url) => {
    setPlaylistUrl(url);
    setError(null);
  };

  return (
    <div className="min-h-[85vh] py-16 px-6 max-w-4xl mx-auto flex flex-col justify-center">
      
      {/* Editorial Page Header */}
      <div className="mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-[#70e000] block mb-3">
          STEP 01 — SETUP
        </span>
        <h1 className="font-editorial text-5xl sm:text-6xl md:text-7xl font-extrabold uppercase tracking-tight text-white leading-[0.95]">
          BUILD YOUR <br />
          STUDY PLAN.
        </h1>
        <p className="mt-4 text-base md:text-lg text-neutral-400">
          Configure your weekly study capacity and let StudyFlow generate an actionable semester plan.
        </p>
      </div>

      {/* Main Creation Form Card */}
      <div className="p-8 sm:p-12 rounded-3xl border border-white/10 bg-[#0f1117] shadow-2xl relative">
        
        {/* Error notification */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Notice:</span>
              {error}
            </div>
          </div>
        )}

        {/* Loading Progress State */}
        {isLoading ? (
          <div className="py-16 text-center space-y-6">
            <div className="inline-flex p-4 rounded-2xl bg-white/5 border border-white/10 animate-bounce">
              <Sparkles className="w-8 h-8 text-[#70e000]" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-editorial font-bold text-white">
                {loadingSteps[loadingStep]}
              </h3>
              <p className="text-sm font-mono text-neutral-400">
                Step {loadingStep + 1} of {loadingSteps.length}
              </p>
            </div>

            {/* Visual step indicator */}
            <div className="max-w-md mx-auto flex items-center justify-between gap-2 pt-4">
              {loadingSteps.map((step, idx) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    idx <= loadingStep ? 'bg-[#70e000]' : 'bg-neutral-800'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Playlist URL Field */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2">
                YouTube Playlist URL
              </label>
              <input
                type="text"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="https://youtube.com/playlist?list=..."
                required
                className="w-full px-5 py-4 rounded-xl bg-[#161922] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#70e000] transition-colors font-mono text-sm"
              />

              {/* Sample Quick-Click Presets for College Demo */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                <span className="font-mono text-neutral-500">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleDemoSelect("https://www.youtube.com/playlist?list=PLBlnK6fEyqRitWLDVQzCEGIH_OQk8s2_T")}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300 hover:text-white transition-colors"
                >
                  Operating Systems Course
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoSelect("https://www.youtube.com/playlist?list=PLgUwDviBIf0oF6QL8m22w1hIDC1vJ_st8")}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300 hover:text-white transition-colors"
                >
                  DSA Complete Course
                </button>
              </div>
            </div>

            {/* Grid for Study Capacity & Target Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Hours Per Week */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#70e000]" />
                  Available Study Hours Per Week
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)}
                    required
                    className="w-full px-5 py-4 rounded-xl bg-[#161922] border border-white/10 text-white focus:outline-none focus:border-[#70e000] transition-colors font-mono text-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-400">
                    hours / week
                  </span>
                </div>
              </div>

              {/* Target Date */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#70e000]" />
                  Target Completion Date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                  className="w-full px-5 py-4 rounded-xl bg-[#161922] border border-white/10 text-white focus:outline-none focus:border-[#70e000] transition-colors font-mono text-sm [color-scheme:dark]"
                />
              </div>

            </div>

            {/* Study Intensity Selector */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#70e000]" />
                Study Intensity
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Relaxed', desc: '1.25x effort (review)' },
                  { id: 'Balanced', desc: '1.5x effort (notes)' },
                  { id: 'Intensive', desc: '2.0x effort (code/practice)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIntensity(item.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      intensity === item.id
                        ? 'border-[#70e000] bg-[#70e000]/10 text-white'
                        : 'border-white/5 bg-[#161922] text-neutral-400 hover:text-white hover:border-white/15'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{item.id}</div>
                    <div className="text-[11px] font-mono text-neutral-400 mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              className="w-full py-4 rounded-full bg-white hover:bg-[#70e000] text-black font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#70e000]/25 group"
            >
              Analyze Playlist
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

          </form>
        )}

      </div>

    </div>
  );
}

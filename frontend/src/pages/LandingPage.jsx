import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Play, 
  Layers, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  RotateCcw, 
  Compass, 
  Sparkles,
  ListOrdered
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      
      {/* Subtle Background Radial Gradient / Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-10" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#70e000]/5 blur-[140px] pointer-events-none -z-10" />

      {/* ========================================================= */}
      {/* HERO SECTION */}
      {/* ========================================================= */}
      <section className="min-h-[88vh] flex flex-col justify-center px-6 max-w-7xl mx-auto pt-12 pb-24">
        
        {/* Editorial Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-mono tracking-wider text-neutral-300 w-fit mb-8">
          <span className="w-2 h-2 rounded-full bg-[#70e000] animate-pulse"></span>
          AI STUDY PLANNER
        </div>

        {/* Large Editorial Headline */}
        <h1 className="font-editorial text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter leading-[0.92] text-white uppercase max-w-5xl">
          TURN PLAYLISTS <br />
          <span className="text-neutral-500">INTO</span> <br />
          PROGRESS.
        </h1>

        {/* Supporting Copy & CTAs */}
        <div className="mt-12 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <p className="text-lg md:text-xl text-neutral-400 max-w-xl font-normal leading-relaxed">
            Paste a YouTube study playlist and get a topic-wise study plan with realistic weekly deadlines, video progress, and automatic replanning.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/create"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-sm font-semibold tracking-wide bg-white text-black hover:bg-[#70e000] hover:text-black transition-all shadow-lg hover:shadow-[#70e000]/25 group"
            >
              Create Your Plan
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold tracking-wide border border-white/10 hover:border-white/20 text-neutral-300 hover:text-white bg-white/[0.02] hover:bg-white/[0.05] transition-all"
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Floating Example Pill / Card */}
        <div className="mt-20 p-6 rounded-2xl border border-white/10 bg-neutral-900/60 backdrop-blur-md max-w-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center text-[#70e000]">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-400">Example Course</div>
              <div className="text-base font-semibold text-white">Operating Systems Course</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm font-mono text-neutral-400 border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
            <div>
              <span className="text-white font-bold block text-base">42</span> videos
            </div>
            <div>
              <span className="text-white font-bold block text-base">18.4h</span> duration
            </div>
            <div>
              <span className="text-[#70e000] font-bold block text-base">6 weeks</span> schedule
            </div>
          </div>
        </div>
      </section>


      {/* ========================================================= */}
      {/* THE PROBLEM SECTION */}
      {/* ========================================================= */}
      <section className="py-28 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          <div className="lg:col-span-5">
            <span className="text-xs font-mono uppercase tracking-widest text-[#70e000] block mb-3">
              THE BOTTLENECK
            </span>
            <h2 className="font-editorial text-5xl md:text-6xl font-extrabold uppercase tracking-tight text-white leading-[0.95]">
              PLAYLISTS <br />
              AREN'T <br />
              STUDY PLANS.
            </h2>
            <p className="mt-8 text-neutral-400 text-base md:text-lg leading-relaxed">
              YouTube has incredible study material, but playlists rarely tell you how long the course will take, what topics belong together, or how much you should complete each week.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 01 */}
            <div className="p-8 rounded-2xl border border-white/10 bg-[#111319]/80 flex flex-col justify-between h-72 hover:border-[#70e000]/40 transition-colors">
              <span className="font-mono text-2xl font-bold text-neutral-500">01</span>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">No Structure</h3>
                <p className="text-sm text-neutral-400 leading-normal">
                  Dozens of arbitrary video titles with no concept clustering or topic roadmaps.
                </p>
              </div>
            </div>

            {/* Card 02 */}
            <div className="p-8 rounded-2xl border border-white/10 bg-[#111319]/80 flex flex-col justify-between h-72 md:translate-y-4 hover:border-[#70e000]/40 transition-colors">
              <span className="font-mono text-2xl font-bold text-neutral-500">02</span>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">No Pacing</h3>
                <p className="text-sm text-neutral-400 leading-normal">
                  No realistic calculation of pause-and-practice time or weekly target hours.
                </p>
              </div>
            </div>

            {/* Card 03 */}
            <div className="p-8 rounded-2xl border border-white/10 bg-[#111319]/80 flex flex-col justify-between h-72 md:translate-y-8 hover:border-[#70e000]/40 transition-colors">
              <span className="font-mono text-2xl font-bold text-neutral-500">03</span>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">No Accountability</h3>
                <p className="text-sm text-neutral-400 leading-normal">
                  Fall behind by two days, and the entire self-study effort is abandoned.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ========================================================= */}
      {/* HOW IT WORKS SECTION (Staggered Cards) */}
      {/* ========================================================= */}
      <section id="how-it-works" className="py-28 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-[#70e000] block mb-3">
            WORKFLOW
          </span>
          <h2 className="font-editorial text-5xl md:text-6xl font-extrabold uppercase tracking-tight text-white leading-none">
            FROM LINK <br />
            TO PLAN.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Step 01 */}
          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] flex flex-col justify-between min-h-[300px] hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
                01 — PASTE
              </span>
              <Play className="w-5 h-5 text-neutral-500" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-3">Paste</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Paste any public YouTube playlist link from lectures, bootcamps, or courses.
              </p>
            </div>
          </div>

          {/* Step 02 */}
          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] flex flex-col justify-between min-h-[300px] lg:translate-y-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
                02 — UNDERSTAND
              </span>
              <Layers className="w-5 h-5 text-neutral-500" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-3">Understand</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                StudyFlow extracts titles, descriptions, and exact video durations via API.
              </p>
            </div>
          </div>

          {/* Step 03 */}
          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] flex flex-col justify-between min-h-[300px] hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
                03 — ORGANIZE
              </span>
              <ListOrdered className="w-5 h-5 text-neutral-500" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-3">Organize</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Semantic clustering groups related videos into meaningful academic modules.
              </p>
            </div>
          </div>

          {/* Step 04 */}
          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] flex flex-col justify-between min-h-[300px] lg:translate-y-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
                04 — SCHEDULE
              </span>
              <Calendar className="w-5 h-5 text-[#70e000]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-3">Schedule</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                A realistic weekly study plan is generated from your weekly hours and target deadline.
              </p>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================================= */}
      {/* PRODUCT PREVIEW DASHBOARD MOCKUP */}
      {/* ========================================================= */}
      <section className="py-24 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="rounded-3xl border border-white/10 bg-[#0d0f15] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#70e000]/10 blur-[120px] pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/5">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-400">Interactive Preview</div>
              <h3 className="text-3xl font-editorial font-bold text-white mt-1">Data Structures & Algorithms</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#70e000]/15 text-[#70e000] border border-[#70e000]/30 text-xs font-semibold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#70e000]"></span>
                ON TRACK
              </span>
              <Link 
                to="/dashboard"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
              >
                Open Dashboard
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
            <div className="p-6 rounded-2xl bg-[#141720] border border-white/5">
              <span className="text-xs font-mono text-neutral-400 uppercase">Overall Progress</span>
              <div className="text-4xl font-editorial font-extrabold text-white mt-2">34%</div>
              <div className="text-xs text-neutral-500 mt-1">14 of 42 videos completed</div>
            </div>

            <div className="p-6 rounded-2xl bg-[#141720] border border-white/5">
              <span className="text-xs font-mono text-neutral-400 uppercase">Current Week</span>
              <div className="text-4xl font-editorial font-extrabold text-white mt-2">Week 3</div>
              <div className="text-xs text-[#70e000] mt-1">Linked Lists & Stacks</div>
            </div>

            <div className="p-6 rounded-2xl bg-[#141720] border border-white/5">
              <span className="text-xs font-mono text-neutral-400 uppercase">Weekly Target</span>
              <div className="text-4xl font-editorial font-extrabold text-white mt-2">6 / 12</div>
              <div className="text-xs text-neutral-400 mt-1">Videos completed this week</div>
            </div>
          </div>

          {/* Progress bar visual */}
          <div className="w-full bg-neutral-800/80 rounded-full h-3 overflow-hidden">
            <div className="bg-[#70e000] h-3 rounded-full transition-all" style={{ width: '34%' }}></div>
          </div>
        </div>
      </section>


      {/* ========================================================= */}
      {/* FEATURES SECTION */}
      {/* ========================================================= */}
      <section className="py-28 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="max-w-xl mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-[#70e000] block mb-3">
            CORE CAPABILITIES
          </span>
          <h2 className="font-editorial text-5xl md:text-6xl font-extrabold uppercase tracking-tight text-white leading-none">
            BUILT FOR <br />
            ACTUAL STUDYING.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] hover:border-white/20 transition-all">
            <Layers className="w-6 h-6 text-[#70e000] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Topic Breakdown</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Videos are grouped into meaningful learning topics rather than raw scattered links.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] hover:border-white/20 transition-all">
            <Clock className="w-6 h-6 text-[#70e000] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Realistic Effort</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Study time accounts for video playback, active pausing, note-taking, and practice.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] hover:border-white/20 transition-all">
            <Calendar className="w-6 h-6 text-[#70e000] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Weekly Deadlines</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Know exactly what needs to be completed every week to hit your semester goal.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] hover:border-white/20 transition-all">
            <CheckCircle2 className="w-6 h-6 text-[#70e000] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Progress Tracking</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Check off videos as you complete them with live persistent status updates.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] hover:border-white/20 transition-all">
            <RotateCcw className="w-6 h-6 text-[#70e000] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Automatic Replanning</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Fall behind? StudyFlow deterministically redistributes the remaining workload.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-white/10 bg-[#0f1117] hover:border-white/20 transition-all">
            <Compass className="w-6 h-6 text-[#70e000] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Feasibility Check</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Tells the student how many hours per week are required to meet their deadline.
            </p>
          </div>

        </div>
      </section>


      {/* ========================================================= */}
      {/* FINAL CTA SECTION */}
      {/* ========================================================= */}
      <section className="py-32 px-6 max-w-7xl mx-auto border-t border-white/5 text-center">
        <h2 className="font-editorial text-5xl sm:text-6xl md:text-7xl font-extrabold uppercase tracking-tight text-white leading-[0.95] max-w-3xl mx-auto">
          YOUR NEXT PLAYLIST <br />
          <span className="text-[#70e000]">DESERVES A PLAN.</span>
        </h2>
        
        <p className="mt-8 text-lg text-neutral-400 max-w-lg mx-auto">
          Paste any YouTube playlist and turn passive browsing into structured academic progress.
        </p>

        <div className="mt-10">
          <Link
            to="/create"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-full text-base font-semibold tracking-wide bg-white text-black hover:bg-[#70e000] hover:text-black transition-all shadow-xl hover:shadow-[#70e000]/25 group"
          >
            Build My Study Plan
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

    </div>
  );
}

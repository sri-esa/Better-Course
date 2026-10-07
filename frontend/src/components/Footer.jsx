import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#08090d] text-neutral-400 py-16 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        
        {/* Brand identity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white font-editorial text-xl font-bold">
            <BookOpen className="w-5 h-5 text-[#70e000]" />
            StudyFlow
          </div>
          <p className="text-sm text-neutral-500">
            Turn playlists into progress.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center gap-8 text-sm">
          <Link to="/plan/latest" className="hover:text-white transition-colors">
            Plan
          </Link>
          <Link to="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <a href="/#how-it-works" className="hover:text-white transition-colors">
            How It Works
          </a>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-white flex items-center gap-1 transition-colors"
          >
            GitHub
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Student learning note */}
        <div className="text-xs text-neutral-500 font-mono">
          Built as a student learning project.
        </div>
      </div>
    </footer>
  );
}

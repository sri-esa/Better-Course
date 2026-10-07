import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, BookOpen } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: 'Plan', path: '/plan/latest' },
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'How it works', path: '/#how-it-works' },
  ];

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#090a0f]/80 border-b border-white/5 transition-all">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* StudyFlow Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/10 flex items-center justify-center text-[#70e000] shadow-inner group-hover:border-[#70e000]/50 transition-colors">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="font-editorial text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
            StudyFlow
            <span className="w-1.5 h-1.5 rounded-full bg-[#70e000]"></span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              className={`text-sm font-medium tracking-wide transition-colors ${
                location.pathname === link.path 
                  ? 'text-white' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right CTA Button */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white text-black hover:bg-[#70e000] hover:text-black transition-all shadow-sm hover:shadow-[#70e000]/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Create Plan
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-[#0c0e14] border-b border-white/10 px-6 py-6 space-y-4 animate-in fade-in">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className="block text-base font-medium text-neutral-300 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 border-t border-white/5">
            <Link
              to="/create"
              onClick={() => setIsOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-white text-black hover:bg-[#70e000]"
            >
              <Sparkles className="w-4 h-4" />
              Create Plan
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

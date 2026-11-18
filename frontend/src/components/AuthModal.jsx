import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { X, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const { authModalOpen, setAuthModalOpen, authMode, setAuthMode, login, register, loginWithGoogle } =
    useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authModalOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (authMode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      setEmail('');
      setPassword('');
      setName('');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    setLoading(true);
    try {
      if (credentialResponse.credential) {
        await loginWithGoogle(credentialResponse.credential);
      }
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleError() {
    setError('Google Sign-In was cancelled or failed.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="bg-[#0f1117] border border-white/10 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 bg-[#70e000]/10 text-[#70e000] text-xs font-mono uppercase tracking-widest rounded-full mb-3 border border-[#70e000]/20">
            BetterCourse Account
          </span>
          <h2 className="font-editorial text-3xl font-extrabold uppercase tracking-tight text-white">
            {authMode === 'login' ? 'WELCOME BACK.' : 'JOIN STUDYFLOW.'}
          </h2>
          <p className="text-sm text-neutral-400 mt-2">
            {authMode === 'login'
              ? 'Access your saved playlists, custom schedules & study stats'
              : 'Save your study plans and track progress across any device'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          <button
            onClick={() => {
              setAuthMode('login');
              setError('');
            }}
            className={`flex-1 pb-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
              authMode === 'login'
                ? 'border-[#70e000] text-[#70e000]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setAuthMode('register');
              setError('');
            }}
            className={`flex-1 pb-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
              authMode === 'register'
                ? 'border-[#70e000] text-[#70e000]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 bg-red-950/40 border border-red-500/30 text-red-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="flex justify-center mb-5">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="filled_black"
            size="large"
            shape="pill"
            width="100%"
            text={authMode === 'login' ? 'signin_with' : 'signup_with'}
          />
        </div>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink mx-3 text-neutral-500 text-[11px] font-mono uppercase tracking-wider">
            or continue with email
          </span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'register' && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-4 py-3 rounded-xl bg-[#161922] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#70e000] text-sm font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl bg-[#161922] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#70e000] text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-[#161922] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#70e000] text-sm font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-white hover:bg-[#70e000] text-black font-semibold rounded-full text-xs uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {loading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import LandingPage from './pages/LandingPage';
import CreatePlanPage from './pages/CreatePlanPage';
import StudyPlanPage from './pages/StudyPlanPage';
import DashboardPage from './pages/DashboardPage';
import PlaylistDetailsPage from './pages/PlaylistDetailsPage';
import MyCoursesPage from './pages/MyCoursesPage';

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '330212907264-qc0uuld2o3jnjj8ksi0frtski141clsb.apps.googleusercontent.com';

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-[#090a0f] text-[#e2e8f0]">
            <Navbar />
            <AuthModal />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/create" element={<CreatePlanPage />} />
                <Route path="/plan/:playlistId" element={<StudyPlanPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/playlist/:playlistId" element={<PlaylistDetailsPage />} />
                <Route path="/my-courses" element={<MyCoursesPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import CreatePlanPage from './pages/CreatePlanPage';
import StudyPlanPage from './pages/StudyPlanPage';
import DashboardPage from './pages/DashboardPage';
import PlaylistDetailsPage from './pages/PlaylistDetailsPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#090a0f] text-[#e2e8f0]">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/create" element={<CreatePlanPage />} />
            <Route path="/plan/:playlistId" element={<StudyPlanPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/playlist/:playlistId" element={<PlaylistDetailsPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

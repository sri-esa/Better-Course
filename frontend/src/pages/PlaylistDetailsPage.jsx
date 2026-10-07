import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Clock, BookOpen, ExternalLink, ArrowRight, Layers } from 'lucide-react';

export default function PlaylistDetailsPage() {
  const { playlistId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/playlists/${playlistId}`);
        if (!res.ok) throw new Error('Playlist details not found.');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [playlistId]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-[#70e000] rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-neutral-400">Loading playlist details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-3xl font-editorial font-bold text-white mb-2">Playlist Not Found</h2>
        <p className="text-neutral-400 mb-6">{error}</p>
        <Link to="/create" className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs uppercase">
          Create Plan Instead
        </Link>
      </div>
    );
  }

  return (
    <div className="py-12 px-6 max-w-7xl mx-auto space-y-12">
      {/* Header */}
      <div className="p-8 rounded-3xl border border-white/10 bg-[#0f1117] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-[#70e000]">
            PLAYLIST OVERVIEW
          </span>
          <h1 className="text-3xl md:text-4xl font-editorial font-extrabold text-white mt-1">
            {data.playlist_title}
          </h1>
          <div className="flex items-center gap-4 text-xs font-mono text-neutral-400 mt-2">
            <span>{data.total_videos} videos</span>
            <span>•</span>
            <span>{data.total_duration_formatted} total duration</span>
            <span>•</span>
            <span>{data.topics.length} topics</span>
          </div>
        </div>

        <Link
          to={`/plan/${data.id}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-[#70e000] text-black font-semibold text-xs uppercase tracking-wider transition-colors"
        >
          View Full Plan
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Topics list */}
      <div className="space-y-6">
        <h2 className="text-2xl font-editorial font-bold text-white">Modules & Video Contents</h2>
        
        <div className="space-y-4">
          {data.topics.map((t) => (
            <div key={t.id} className="p-6 rounded-2xl border border-white/10 bg-[#11131a] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                    Topic 0{t.order_number}
                  </span>
                  <h3 className="text-xl font-bold text-white">{t.name}</h3>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 text-neutral-300">
                  {t.difficulty}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                {t.videos.map((v) => (
                  <div key={v.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs font-mono text-neutral-300">
                    <span className="truncate pr-3">{v.position}. {v.title}</span>
                    <span className="text-neutral-500 shrink-0">{v.duration_formatted}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

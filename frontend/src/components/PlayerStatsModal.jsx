import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { X, TrendingUp, Flame, Trophy, Beaker, Sparkles } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Character images mapping
const CHARACTER_IMAGES = {
  luna: '/characters/luna.png',
  max: '/characters/max.png', 
  rex: '/characters/rex.png'
};

// Rarity colors
const RARITY_COLORS = {
  Common: 'text-gray-400',
  Uncommon: 'text-green-400',
  Rare: 'text-blue-400',
  Epic: 'text-purple-400',
  Legendary: 'text-yellow-400',
  Mythic: 'text-red-400'
};

const RARITY_BG = {
  Common: 'bg-gray-500/20',
  Uncommon: 'bg-green-500/20',
  Rare: 'bg-blue-500/20',
  Epic: 'bg-purple-500/20',
  Legendary: 'bg-yellow-500/20',
  Mythic: 'bg-red-500/20'
};

const PlayerStatsModal = ({ playerAddress, onClose }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!playerAddress) return;
      
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/player-stats/${playerAddress}`);
        
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          throw new Error('Failed to load stats');
        }
      } catch (err) {
        console.error('Error fetching player stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerAddress]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!playerAddress) return null;

  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden shadow-2xl relative" data-testid="player-stats-modal">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
          data-testid="close-player-stats-modal"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {loading ? (
          <CardContent className="p-8 text-center">
            <div className="animate-spin text-5xl mb-4">🧪</div>
            <p className="text-slate-400">Loading stats...</p>
          </CardContent>
        ) : error ? (
          <CardContent className="p-8 text-center">
            <div className="text-5xl mb-4">😔</div>
            <p className="text-red-400">{error}</p>
          </CardContent>
        ) : stats ? (
          <CardContent className="p-0">
            {/* Header with Character Image - Inspired by NBA design */}
            <div className="relative h-48 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800 overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '20px 20px'
                }} />
              </div>
              
              {/* Character Image */}
              <div className="absolute -bottom-6 -right-4 w-40 h-40 opacity-90">
                <img 
                  src={stats.player.character_image || CHARACTER_IMAGES[stats.player.selected_character] || CHARACTER_IMAGES.luna}
                  alt={stats.player.selected_character}
                  className="w-full h-full object-contain drop-shadow-2xl"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              
              {/* Player Info Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-end justify-between">
                  <div>
                    <Badge className="bg-sky-500/80 text-white text-xs mb-2">
                      {stats.period}
                    </Badge>
                    <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                      {stats.player.nickname || 'Scientist'}
                    </h2>
                    <p className="text-sky-200 text-sm font-mono">
                      {formatAddress(stats.player.address)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-white drop-shadow-lg">
                      Lv.{stats.player.level}
                    </div>
                    {stats.player.is_nft_holder && (
                      <Badge className="bg-yellow-500 text-black text-xs font-bold">
                        VIP
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Stats Grid - NBA Style */}
            <div className="p-4">
              {/* Primary Stats Row */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-2xl font-black text-white">{stats.stats.treats_created}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Treats</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-2xl font-black text-green-400">{stats.stats.points_earned.toLocaleString()}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Points</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-2xl font-black text-blue-400">{stats.stats.xp_gained.toLocaleString()}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">XP</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-xl">
                  <div className="text-2xl font-black text-purple-400">{stats.stats.unique_formulas}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Recipes</div>
                </div>
              </div>

              {/* Streak & Best Rarity */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Streak Card */}
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-xs text-orange-300 uppercase tracking-wider">Streak</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white">{stats.streak.current}</span>
                    <span className="text-sm text-orange-300">days</span>
                  </div>
                  <div className="text-xs text-orange-400 mt-1">{stats.streak.title}</div>
                  <div className="text-xs text-slate-400">Best: {stats.streak.longest} days</div>
                </div>

                {/* Best Rarity Card */}
                <div className={`${RARITY_BG[stats.stats.best_rarity] || 'bg-slate-800/50'} border border-slate-600/30 rounded-xl p-3`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-slate-300 uppercase tracking-wider">Best Find</span>
                  </div>
                  <div className={`text-2xl font-black ${RARITY_COLORS[stats.stats.best_rarity] || 'text-white'}`}>
                    {stats.stats.best_rarity}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">This Week</div>
                </div>
              </div>

              {/* Rarity Breakdown */}
              <div className="bg-slate-800/30 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Beaker className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-semibold text-white">Rarity Breakdown</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(stats.rarity_breakdown).map(([rarity, count]) => (
                    <div key={rarity} className={`text-center p-2 rounded-lg ${RARITY_BG[rarity]}`}>
                      <div className={`text-lg font-bold ${RARITY_COLORS[rarity]}`}>{count}</div>
                      <div className="text-xs text-slate-400">{rarity}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Activity Chart (Simple) */}
              <div className="bg-slate-800/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-white">Daily Activity</span>
                </div>
                <div className="flex items-end justify-between gap-1 h-16">
                  {Object.entries(stats.daily_breakdown)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, data]) => {
                      const maxTreats = Math.max(...Object.values(stats.daily_breakdown).map(d => d.treats), 1);
                      const height = (data.treats / maxTreats) * 100;
                      const dayLabel = new Date(day).toLocaleDateString('en', { weekday: 'short' });
                      
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-gradient-to-t from-sky-500 to-sky-400 rounded-t-sm transition-all duration-300"
                            style={{ height: `${Math.max(height, 4)}%` }}
                            title={`${data.treats} treats, ${data.points} pts`}
                          />
                          <span className="text-[10px] text-slate-500">{dayLabel}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Averages Footer */}
              <div className="flex justify-between mt-4 pt-3 border-t border-slate-700">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{stats.stats.avg_treats_per_day}</div>
                  <div className="text-xs text-slate-400">Avg Treats/Day</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">{stats.stats.avg_points_per_day.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Avg Points/Day</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-400">{stats.player.points.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Total Points</div>
                </div>
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
};

export default PlayerStatsModal;

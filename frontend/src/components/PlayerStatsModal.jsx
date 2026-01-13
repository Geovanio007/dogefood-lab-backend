import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { X, TrendingUp, Flame, Beaker, Sparkles } from 'lucide-react';

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!playerAddress) return null;

  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/90 backdrop-blur-md overflow-y-auto p-2 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="player-stats-overlay"
    >
      {/* Modal Container - Full height on mobile with scroll */}
      <div className="w-full max-w-md my-2 sm:my-4 relative">
        {/* Floating Close Button - Always visible */}
        <button
          onClick={onClose}
          className="absolute -top-1 -right-1 sm:top-0 sm:right-0 z-[110] bg-red-500 hover:bg-red-400 rounded-full p-2 shadow-lg transition-colors"
          data-testid="close-player-stats-modal"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <Card className="w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden shadow-2xl" data-testid="player-stats-modal">
          {loading ? (
            <CardContent className="p-8 text-center">
              <div className="animate-spin text-5xl mb-4">🧪</div>
              <p className="text-slate-400">Loading stats...</p>
            </CardContent>
          ) : error ? (
            <CardContent className="p-8 text-center">
              <div className="text-5xl mb-4">😔</div>
              <p className="text-red-400">{error}</p>
              <button 
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Close
              </button>
            </CardContent>
          ) : stats ? (
            <CardContent className="p-0">
              {/* Header with Character Image */}
              <div className="relative h-36 sm:h-44 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }} />
                </div>
                
                {/* Character Image */}
                <div className="absolute -bottom-4 -right-2 w-32 h-32 sm:w-36 sm:h-36 opacity-90">
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
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/70 to-transparent">
                  <div className="flex items-end justify-between pr-24 sm:pr-28">
                    <div>
                      <Badge className="bg-sky-500/80 text-white text-[10px] sm:text-xs mb-1">
                        {stats.period}
                      </Badge>
                      <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg truncate max-w-[180px]">
                        {stats.player.nickname || 'Scientist'}
                      </h2>
                      <p className="text-sky-200 text-xs font-mono">
                        {formatAddress(stats.player.address)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg">
                        Lv.{stats.player.level}
                      </div>
                      {stats.player.is_nft_holder && (
                        <Badge className="bg-yellow-500 text-black text-[10px] font-bold">
                          VIP
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Content - Scrollable on mobile */}
              <div className="p-3 sm:p-4 max-h-[60vh] sm:max-h-none overflow-y-auto">
                {/* Primary Stats Row */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
                  <div className="text-center p-2 sm:p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-lg sm:text-xl font-black text-white">{stats.stats.treats_created}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400 uppercase">Treats</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-lg sm:text-xl font-black text-green-400">{stats.stats.points_earned.toLocaleString()}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400 uppercase">Points</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-lg sm:text-xl font-black text-blue-400">{stats.stats.xp_gained.toLocaleString()}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400 uppercase">XP</div>
                  </div>
                  <div className="text-center p-2 sm:p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-lg sm:text-xl font-black text-purple-400">{stats.stats.unique_formulas}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400 uppercase">Recipes</div>
                  </div>
                </div>

                {/* Streak & Best Rarity */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {/* Streak Card */}
                  <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg p-2 sm:p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400" />
                      <span className="text-[10px] sm:text-xs text-orange-300 uppercase">Streak</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-black text-white">{stats.streak.current}</span>
                      <span className="text-xs sm:text-sm text-orange-300">days</span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-orange-400">{stats.streak.title}</div>
                    <div className="text-[10px] text-slate-400">Best: {stats.streak.longest} days</div>
                  </div>

                  {/* Best Rarity Card */}
                  <div className={`${RARITY_BG[stats.stats.best_rarity] || 'bg-slate-800/50'} border border-slate-600/30 rounded-lg p-2 sm:p-3`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
                      <span className="text-[10px] sm:text-xs text-slate-300 uppercase">Best Find</span>
                    </div>
                    <div className={`text-xl sm:text-2xl font-black ${RARITY_COLORS[stats.stats.best_rarity] || 'text-white'}`}>
                      {stats.stats.best_rarity}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-400">This Week</div>
                  </div>
                </div>

                {/* Rarity Breakdown */}
                <div className="bg-slate-800/30 rounded-lg p-2 sm:p-3 mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Beaker className="w-3 h-3 sm:w-4 sm:h-4 text-sky-400" />
                    <span className="text-xs sm:text-sm font-semibold text-white">Rarity Breakdown</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {Object.entries(stats.rarity_breakdown).map(([rarity, count]) => (
                      <div key={rarity} className={`text-center p-1.5 rounded ${RARITY_BG[rarity]}`}>
                        <div className={`text-sm sm:text-base font-bold ${RARITY_COLORS[rarity]}`}>{count}</div>
                        <div className="text-[8px] sm:text-[10px] text-slate-400 truncate">{rarity.slice(0,3)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily Activity Chart */}
                <div className="bg-slate-800/30 rounded-lg p-2 sm:p-3 mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                    <span className="text-xs sm:text-sm font-semibold text-white">Daily Activity</span>
                  </div>
                  <div className="flex items-end justify-between gap-1 h-12 sm:h-14">
                    {Object.entries(stats.daily_breakdown)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([day, data]) => {
                        const maxTreats = Math.max(...Object.values(stats.daily_breakdown).map(d => d.treats), 1);
                        const height = (data.treats / maxTreats) * 100;
                        const dayLabel = new Date(day).toLocaleDateString('en', { weekday: 'narrow' });
                        
                        return (
                          <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                            <div 
                              className="w-full bg-gradient-to-t from-sky-500 to-sky-400 rounded-t-sm transition-all duration-300 min-h-[2px]"
                              style={{ height: `${Math.max(height, 4)}%` }}
                              title={`${data.treats} treats`}
                            />
                            <span className="text-[9px] sm:text-[10px] text-slate-500">{dayLabel}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Averages Footer */}
                <div className="flex justify-between pt-2 border-t border-slate-700">
                  <div className="text-center">
                    <div className="text-sm sm:text-base font-bold text-white">{stats.stats.avg_treats_per_day}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400">Avg/Day</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm sm:text-base font-bold text-green-400">{Math.round(stats.stats.avg_points_per_day).toLocaleString()}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400">Pts/Day</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm sm:text-base font-bold text-yellow-400">{stats.player.points.toLocaleString()}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400">Total Pts</div>
                  </div>
                </div>
              </div>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default PlayerStatsModal;

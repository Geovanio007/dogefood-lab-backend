import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { X, TrendingUp, Flame, Beaker, Trophy, Gem, Share2, Download, Check } from 'lucide-react';
import html2canvas from 'html2canvas';

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
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const cardRef = useRef(null);

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-2"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="player-stats-overlay"
    >
      {/* Modal Container - Compact and centered */}
      <div className="w-full max-w-sm relative">
        {/* Floating Close Button - Always visible */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-[110] bg-red-500 hover:bg-red-400 rounded-full p-1.5 shadow-lg transition-colors"
          data-testid="close-player-stats-modal"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <Card className="w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto" data-testid="player-stats-modal">
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
              {/* Header with Character Image - Compact */}
              <div className="relative h-24 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800 overflow-hidden">
                {/* Character Image */}
                <div className="absolute -bottom-2 -right-2 w-24 h-24 opacity-90">
                  <img 
                    src={stats.player.character_image || CHARACTER_IMAGES[stats.player.selected_character] || CHARACTER_IMAGES.luna}
                    alt={stats.player.selected_character}
                    className="w-full h-full object-contain drop-shadow-2xl"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                
                {/* Player Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                  <div className="flex items-end justify-between pr-20">
                    <div>
                      <Badge className="bg-sky-500/80 text-white text-[9px] mb-0.5">{stats.period}</Badge>
                      <h2 className="text-base font-bold text-white drop-shadow-lg truncate max-w-[140px]">
                        {stats.player.nickname || 'Scientist'}
                      </h2>
                      <p className="text-sky-200 text-[10px] font-mono">{formatAddress(stats.player.address)}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-white drop-shadow-lg">Lv.{stats.player.level}</div>
                      {stats.player.is_nft_holder && (
                        <Badge className="bg-yellow-500 text-black text-[9px] font-bold">VIP</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Content - Compact layout */}
              <div className="p-2">
                {/* Rank Banner */}
                {stats.rank && (
                  <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border border-yellow-500/30 rounded-lg p-2 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <div>
                        <div className="text-yellow-300 text-[10px] uppercase font-semibold">Leaderboard Rank</div>
                        <div className="text-2xl font-black text-white">#{stats.rank}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">out of</div>
                      <div className="text-lg font-bold text-slate-300">{stats.total_players} players</div>
                    </div>
                  </div>
                )}
                
                {/* Primary Stats Row - 4 compact boxes */}
                <div className="grid grid-cols-4 gap-1 mb-2">
                  <div className="text-center p-1.5 bg-slate-800/50 rounded">
                    <div className="text-base font-black text-white">{stats.stats.treats_created}</div>
                    <div className="text-[8px] text-slate-400 uppercase">Treats</div>
                  </div>
                  <div className="text-center p-1.5 bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded border border-green-500/30">
                    <div className="text-base font-black text-green-400">{stats.player.points.toLocaleString()}</div>
                    <div className="text-[8px] text-green-300 uppercase">Total Pts</div>
                  </div>
                  <div className="text-center p-1.5 bg-slate-800/50 rounded">
                    <div className="text-base font-black text-blue-400">{stats.stats.xp_gained.toLocaleString()}</div>
                    <div className="text-[8px] text-slate-400 uppercase">7d XP</div>
                  </div>
                  <div className="text-center p-1.5 bg-slate-800/50 rounded">
                    <div className="text-base font-black text-purple-400">{stats.stats.unique_formulas}</div>
                    <div className="text-[8px] text-slate-400 uppercase">Recipes</div>
                  </div>
                </div>

                {/* Streak & Best Rarity - Side by side compact */}
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Flame className="w-3 h-3 text-orange-400" />
                      <span className="text-[9px] text-orange-300 uppercase">Streak</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-white">{stats.streak.current}</span>
                      <span className="text-[10px] text-orange-300">days</span>
                    </div>
                    <div className="text-[9px] text-orange-400">{stats.streak.title}</div>
                  </div>
                  <div className={`${RARITY_BG[stats.stats.best_rarity] || 'bg-slate-800/50'} border border-slate-600/30 rounded p-2`}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <Gem className="w-3 h-3 text-yellow-400" />
                      <span className="text-[9px] text-slate-300 uppercase">Best Find</span>
                    </div>
                    <div className={`text-lg font-black ${RARITY_COLORS[stats.stats.best_rarity] || 'text-white'}`}>
                      {stats.stats.best_rarity}
                    </div>
                    <div className="text-[9px] text-slate-400">This Week</div>
                  </div>
                </div>

                {/* Rarity Breakdown - Compact */}
                <div className="bg-slate-800/30 rounded p-2 mb-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Beaker className="w-3 h-3 text-sky-400" />
                    <span className="text-[10px] font-semibold text-white">Rarity Breakdown</span>
                  </div>
                  <div className="grid grid-cols-6 gap-0.5">
                    {Object.entries(stats.rarity_breakdown).map(([rarity, count]) => (
                      <div key={rarity} className={`text-center py-1 rounded ${RARITY_BG[rarity]}`}>
                        <div className={`text-xs font-bold ${RARITY_COLORS[rarity]}`}>{count}</div>
                        <div className="text-[7px] text-slate-400">{rarity.slice(0,3)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily Activity Chart - Compact */}
                <div className="bg-slate-800/30 rounded p-2 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] font-semibold text-white">Daily Activity</span>
                    </div>
                    <span className="text-[8px] text-slate-400">Last 7 days</span>
                  </div>
                  <div className="flex items-end justify-between gap-0.5 h-12">
                    {Object.entries(stats.daily_breakdown)
                      .sort(([a], [b]) => new Date(a) - new Date(b))
                      .map(([day, data]) => {
                        const maxTreats = Math.max(...Object.values(stats.daily_breakdown).map(d => d.treats || 0), 1);
                        const treats = data.treats || 0;
                        const height = maxTreats > 0 ? (treats / maxTreats) * 100 : 0;
                        const dateObj = new Date(day + 'T12:00:00');
                        const dayLabel = dateObj.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
                        const isToday = new Date().toDateString() === dateObj.toDateString();
                        
                        return (
                          <div key={day} className="flex-1 flex flex-col items-center" title={`${day}: ${treats} treats`}>
                            <span className={`text-[8px] font-bold ${treats > 0 ? 'text-sky-300' : 'text-slate-600'}`}>
                              {treats > 0 ? treats : ''}
                            </span>
                            <div className="w-full h-8 bg-slate-700/50 rounded-sm flex items-end overflow-hidden">
                              <div 
                                className={`w-full rounded-t-sm ${isToday ? 'bg-yellow-400' : 'bg-sky-400'}`}
                                style={{ height: `${Math.max(height, treats > 0 ? 10 : 0)}%` }}
                              />
                            </div>
                            <span className={`text-[7px] ${isToday ? 'text-yellow-400 font-bold' : 'text-slate-500'}`}>
                              {isToday ? '!' : dayLabel}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Averages Footer - Compact */}
                <div className="flex justify-between pt-1.5 border-t border-slate-700">
                  <div className="text-center">
                    <div className="text-sm font-bold text-white">{stats.stats.avg_treats_per_day}</div>
                    <div className="text-[8px] text-slate-400">Avg/Day</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-sky-400">{stats.stats.points_earned.toLocaleString()}</div>
                    <div className="text-[8px] text-slate-400">7d Pts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-green-400">{Math.round(stats.stats.avg_points_per_day).toLocaleString()}</div>
                    <div className="text-[8px] text-slate-400">Pts/Day</div>
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

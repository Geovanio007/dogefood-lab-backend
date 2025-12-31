import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { ArrowLeft, Trophy, Crown, Star, Users, TrendingUp, Clock, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Season 1 End Date - 90 days from Dec 1, 2025 (Season started Dec 1, 2025)
const SEASON_1_END = new Date('2026-03-01T00:00:00Z').getTime();

// Season Countdown Component - Mobile Optimized
const SeasonCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = SEASON_1_END - now;
      
      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
      
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      };
    };
    
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="bg-gradient-to-r from-sky-500/20 to-yellow-500/20 rounded-xl p-3 sm:p-4 border border-sky-400/30">
      <div className="text-xs sm:text-sm text-sky-400 mb-2 text-center font-semibold flex items-center justify-center gap-1 sm:gap-2">
        <Clock className="w-3 h-3 sm:w-4 sm:h-4" /> SEASON 1 ENDS IN
      </div>
      <div className="flex gap-1.5 sm:gap-3 justify-center">
        <div className="text-center">
          <div className="bg-sky-500/30 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px]">
            <span className="text-lg sm:text-2xl font-bold text-white">{timeLeft.days}</span>
          </div>
          <span className="text-[10px] sm:text-xs text-sky-300 mt-1 block">DAYS</span>
        </div>
        <div className="text-center">
          <div className="bg-sky-500/30 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px]">
            <span className="text-lg sm:text-2xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
          </div>
          <span className="text-[10px] sm:text-xs text-sky-300 mt-1 block">HRS</span>
        </div>
        <div className="text-center">
          <div className="bg-sky-500/30 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px]">
            <span className="text-lg sm:text-2xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
          </div>
          <span className="text-[10px] sm:text-xs text-sky-300 mt-1 block">MIN</span>
        </div>
        <div className="text-center">
          <div className="bg-yellow-500/30 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px]">
            <span className="text-lg sm:text-2xl font-bold text-yellow-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
          </div>
          <span className="text-[10px] sm:text-xs text-yellow-300 mt-1 block">SEC</span>
        </div>
      </div>
    </div>
  );
};

const Leaderboard = () => {
  const { address } = useAccount();
  const { 
    points, 
    isNFTHolder, 
    currentLevel, 
    player
  } = useGame();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [seasonInfo, setSeasonInfo] = useState({
    current: 1,
    timeRemaining: '85 days',
    totalRewards: '70,000,000 LAB',
    participants: 0
  });

  const loadLeaderboard = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        throw new Error('Failed to load leaderboard');
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError(err.message);
      setLeaderboard([]);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await loadLeaderboard();
      setLoading(false);
    };
    
    fetchData();
    
    // Auto-refresh every 30 seconds to update after mixing
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Find current user's rank if they have an address
    if (address && leaderboard && leaderboard.length > 0) {
      const userIndex = leaderboard.findIndex(entry => 
        entry.address && entry.address.toLowerCase() === address.toLowerCase()
      );
      if (userIndex !== -1) {
        setCurrentUserRank(userIndex + 1);
      } else {
        setCurrentUserRank(null);
      }
    }
    
    setSeasonInfo(prev => ({ 
      ...prev, 
      participants: leaderboard ? leaderboard.length : 0
    }));
  }, [address, leaderboard]);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈'; 
      case 3: return '🥉';
      default: return '🏅';
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return 'text-yellow-500';
      case 2: return 'text-slate-400 dark:text-slate-300';
      case 3: return 'text-amber-600 dark:text-amber-400';
      default: return 'text-slate-600 dark:text-slate-300';
    }
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const calculateRewards = (rank) => {
    // Reward calculation based on season specifications
    if (rank <= 10) return `${10000 - (rank - 1) * 1000} LAB`;
    if (rank <= 25) return `${1000 - (rank - 10) * 50} LAB`;
    if (rank <= 50) return `${250 - (rank - 25) * 5} LAB`;
    return '0 LAB';
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="text-center py-20">
          <div className="animate-spin text-6xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-slate-600 dark:text-slate-200">Loading Leaderboard...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="text-center py-20">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-slate-600 dark:text-slate-200 mb-4">Unable to Load Leaderboard</h2>
          <p className="text-slate-500 dark:text-slate-300 mb-6">{error}</p>
          <Button onClick={loadLeaderboard} className="doge-button">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 sm:p-6">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <Link to="/">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm">
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold doge-gradient mb-1 sm:mb-2">🏆 Leaderboard</h1>
            <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300">Top VIP Scientists competing for $LAB rewards</p>
          </div>
        </div>
        
        <Badge className="bg-gradient-to-r from-sky-500 to-blue-500 text-white self-start sm:self-auto text-xs sm:text-sm">
          Season {seasonInfo.current}
        </Badge>
      </div>

      {/* Season Countdown Timer */}
      <div className="mb-6 sm:mb-8">
        <SeasonCountdown />
      </div>

      {/* Season Info */}
      <Card className="glass-panel mb-6 sm:mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Season {seasonInfo.current} Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 rounded-xl">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{seasonInfo.totalRewards}</div>
              <div className="text-sm text-slate-600 dark:text-slate-200">Total Rewards Pool</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/30 dark:to-sky-800/30 rounded-xl">
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{leaderboard.length}</div>
              <div className="text-sm text-slate-600 dark:text-slate-200">Active Players</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-xl">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Coming Soon</div>
              <div className="text-sm text-slate-600 dark:text-slate-200">NFT Minting</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current User Status */}
      {address && (
        <Card className="glass-panel mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold doge-gradient">
                  {currentUserRank ? `#${currentUserRank}` : 'Unranked'}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-200">Current Rank</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{points}</div>
                <div className="text-sm text-slate-600 dark:text-slate-200">Points</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">Level {currentLevel}</div>
                <div className="text-sm text-slate-600 dark:text-slate-200">Lab Level</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {currentUserRank && currentUserRank <= 50 ? calculateRewards(currentUserRank) : '0 LAB'}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-200">Est. Rewards</div>
              </div>
            </div>
            
            {!isNFTHolder && (
              <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  💡 <strong>Pro Tip:</strong> Only DogeFood NFT holders can earn points and compete for $LAB rewards!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Table */}
      <Card className="glass-panel">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            Top 50 VIP Scientists
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {!leaderboard || leaderboard.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="text-4xl sm:text-6xl mb-4">🦗</div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-600 mb-2">It's Quiet Here...</h3>
              <p className="text-sm sm:text-base text-gray-500 mb-6">
                Be the first VIP Scientist to start competing for $LAB rewards!
              </p>
              <Link to="/lab">
                <Button className="doge-button text-sm sm:text-base">
                  Start Creating Treats 🧪
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-2 text-sm">Rank</th>
                      <th className="text-left py-3 px-2 text-sm">Scientist</th>
                      <th className="text-center py-3 px-2 text-sm">Points</th>
                      <th className="text-center py-3 px-2 text-sm">Level</th>
                      <th className="text-center py-3 px-2 text-sm">Status</th>
                      <th className="text-right py-3 px-2 text-sm">Est. Rewards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => {
                      const rank = index + 1;
                      const isCurrentUser = address && entry.address.toLowerCase() === address.toLowerCase();
                      
                      return (
                        <tr 
                          key={entry.address} 
                          className={`border-b border-gray-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                            isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200' : ''
                          } ${rank <= 3 ? `leaderboard-row rank-${rank}` : 'leaderboard-row'}`}
                        >
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{getRankIcon(rank)}</span>
                              <span className={`font-bold ${getRankColor(rank)}`}>
                                #{rank}
                              </span>
                            </div>
                          </td>
                          
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-yellow-400 shadow-lg flex-shrink-0">
                                {entry.character_image ? (
                                  <img 
                                    src={entry.character_image} 
                                    alt={entry.character_name || 'Scientist'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-purple-400 via-pink-500 to-sky-400 flex items-center justify-center">
                                    <span className="text-lg">🧪</span>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                {/* Character Name */}
                                {entry.character_name && (
                                  <div className="text-xs text-purple-500 dark:text-purple-400 font-semibold">
                                    {entry.character_name}
                                  </div>
                                )}
                                {/* Player Nickname */}
                                <div className="font-bold text-gray-800 dark:text-gray-100 truncate text-sm">
                                  {entry.nickname || `Scientist #${rank}`}
                                </div>
                                <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                  {formatAddress(entry.address)}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          <td className="py-4 px-2 text-center">
                            <div className="font-bold text-green-600 dark:text-green-400 text-base">
                              {entry.points.toLocaleString()}
                            </div>
                          </td>
                          
                          <td className="py-4 px-2 text-center">
                            <Badge variant="outline" className="font-bold text-xs">
                              Lv {entry.level}
                            </Badge>
                          </td>
                          
                          <td className="py-4 px-2 text-center">
                            <Badge className={entry.is_nft_holder ? 'vip-badge text-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs'}>
                              {entry.is_nft_holder ? 'VIP' : 'Scientist'}
                            </Badge>
                          </td>
                          
                          <td className="py-4 px-2 text-right">
                            <div className="font-bold text-yellow-600 dark:text-yellow-400 text-sm">
                              {rank <= 50 ? calculateRewards(rank) : '0 LAB'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isCurrentUser = address && entry.address.toLowerCase() === address.toLowerCase();
                  
                  return (
                    <div 
                      key={entry.address}
                      className={`p-3 rounded-xl border ${
                        isCurrentUser 
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' 
                          : 'bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-gray-700'
                      } ${rank <= 3 ? 'ring-2 ring-yellow-400/50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank */}
                        <div className="flex flex-col items-center min-w-[40px]">
                          <span className="text-2xl">{getRankIcon(rank)}</span>
                          <span className={`font-bold text-sm ${getRankColor(rank)}`}>#{rank}</span>
                        </div>
                        
                        {/* Character Avatar */}
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-400 shadow-lg flex-shrink-0">
                          {entry.character_image ? (
                            <img 
                              src={entry.character_image} 
                              alt={entry.character_name || 'Scientist'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-400 via-pink-500 to-sky-400 flex items-center justify-center">
                              <span className="text-xl">🧪</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {/* Character Name */}
                          {entry.character_name && (
                            <div className="text-[10px] text-purple-500 dark:text-purple-400 font-semibold truncate">
                              {entry.character_name}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 dark:text-gray-100 truncate text-sm">
                              {entry.nickname || `Scientist #${rank}`}
                            </span>
                            {isCurrentUser && (
                              <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">You</Badge>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {formatAddress(entry.address)}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Lv {entry.level}</Badge>
                            {entry.is_nft_holder && (
                              <Badge className="vip-badge text-[10px] px-1.5 py-0">VIP</Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Points & Rewards */}
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-green-600 dark:text-green-400 text-lg">
                            {entry.points.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">points</div>
                          <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mt-1">
                            {rank <= 50 ? calculateRewards(rank) : '0 LAB'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Rewards Info - Mobile Optimized */}
      <Card className="glass-panel mt-6 sm:mt-8">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Star className="w-4 h-4 sm:w-5 sm:h-5" />
            Reward Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            <div className="text-center">
              <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">🥇</div>
              <h3 className="font-bold text-xs sm:text-lg text-yellow-500">Ranks 1-10</h3>
              <p className="text-[10px] sm:text-sm text-slate-600 dark:text-slate-200">1K - 10K LAB</p>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">🥈</div>
              <h3 className="font-bold text-xs sm:text-lg text-slate-500 dark:text-slate-300">Ranks 11-25</h3>
              <p className="text-[10px] sm:text-sm text-slate-600 dark:text-slate-200">250 - 1K LAB</p>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">🥉</div>
              <h3 className="font-bold text-xs sm:text-lg text-amber-600 dark:text-amber-400">Ranks 26-50</h3>
              <p className="text-[10px] sm:text-sm text-slate-600 dark:text-slate-200">125 - 250 LAB</p>
            </div>
          </div>
          
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200 text-xs sm:text-sm text-center">
              🎯 <strong>Remember:</strong> Only top 50 DogeFood NFT holders are eligible for $LAB rewards!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Leaderboard;
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { ArrowLeft, Trophy, Crown, Star, Users, TrendingUp, Clock, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Season 1 End Date - 90 days from Dec 1, 2024
const SEASON_1_END = new Date('2025-03-01T00:00:00Z').getTime();

// Season Countdown Component
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
    <div className="bg-gradient-to-r from-sky-500/20 to-yellow-500/20 rounded-xl p-4 border border-sky-400/30">
      <div className="text-sm text-sky-400 mb-2 text-center font-semibold flex items-center justify-center gap-2">
        <Clock className="w-4 h-4" /> SEASON 1 ENDS IN
      </div>
      <div className="flex gap-3 justify-center">
        <div className="text-center">
          <div className="bg-sky-500/30 rounded-lg px-3 py-2 min-w-[50px]">
            <span className="text-2xl font-bold text-white">{timeLeft.days}</span>
          </div>
          <span className="text-xs text-sky-300 mt-1 block">DAYS</span>
        </div>
        <div className="text-center">
          <div className="bg-sky-500/30 rounded-lg px-3 py-2 min-w-[50px]">
            <span className="text-2xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
          </div>
          <span className="text-xs text-sky-300 mt-1 block">HRS</span>
        </div>
        <div className="text-center">
          <div className="bg-sky-500/30 rounded-lg px-3 py-2 min-w-[50px]">
            <span className="text-2xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
          </div>
          <span className="text-xs text-sky-300 mt-1 block">MIN</span>
        </div>
        <div className="text-center">
          <div className="bg-yellow-500/30 rounded-lg px-3 py-2 min-w-[50px]">
            <span className="text-2xl font-bold text-yellow-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
          </div>
          <span className="text-xs text-yellow-300 mt-1 block">SEC</span>
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
      case 2: return 'text-gray-400';
      case 3: return 'text-amber-600';
      default: return 'text-gray-600';
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
          <h2 className="text-2xl font-bold text-gray-600">Loading Leaderboard...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="text-center py-20">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Unable to Load Leaderboard</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Button onClick={loadLeaderboard} className="doge-button">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold doge-gradient mb-2">🏆 Leaderboard</h1>
            <p className="text-gray-600">Top VIP Scientists competing for $LAB rewards</p>
          </div>
        </div>
        
        <Badge className="bg-gradient-to-r from-sky-500 to-blue-500 text-white">
          Season {seasonInfo.current}
        </Badge>
      </div>

      {/* Season Countdown Timer */}
      <div className="mb-8">
        <SeasonCountdown />
      </div>

      {/* Season Info */}
      <Card className="glass-panel mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Season {seasonInfo.current} Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl">
              <div className="text-2xl font-bold text-yellow-600">{seasonInfo.totalRewards}</div>
              <div className="text-sm text-gray-600">Total Rewards Pool</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-sky-50 to-sky-100 rounded-xl">
              <div className="text-2xl font-bold text-sky-600">{leaderboard.length}</div>
              <div className="text-sm text-gray-600">Active Players</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl">
              <div className="text-2xl font-bold text-emerald-600">Coming Soon</div>
              <div className="text-sm text-gray-600">NFT Minting</div>
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
                <div className="text-sm text-gray-600">Current Rank</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{points}</div>
                <div className="text-sm text-gray-600">Points</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">Level {currentLevel}</div>
                <div className="text-sm text-gray-600">Lab Level</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {currentUserRank && currentUserRank <= 50 ? calculateRewards(currentUserRank) : '0 LAB'}
                </div>
                <div className="text-sm text-gray-600">Est. Rewards</div>
              </div>
            </div>
            
            {!isNFTHolder && (
              <div className="mt-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  💡 <strong>Pro Tip:</strong> Only DogeFood NFT holders can earn points and compete for $LAB rewards!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Table */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top 50 VIP Scientists
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!leaderboard || leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🦗</div>
              <h3 className="text-2xl font-bold text-gray-600 mb-2">It's Quiet Here...</h3>
              <p className="text-gray-500 mb-6">
                Be the first VIP Scientist to start competing for $LAB rewards!
              </p>
              <Link to="/lab">
                <Button className="doge-button">
                  Start Creating Treats 🧪
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2">Rank</th>
                    <th className="text-left py-3 px-2">Scientist</th>
                    <th className="text-center py-3 px-2">Points</th>
                    <th className="text-center py-3 px-2">Level</th>
                    <th className="text-center py-3 px-2">Status</th>
                    <th className="text-right py-3 px-2">Est. Rewards</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => {
                    const rank = index + 1;
                    const isCurrentUser = address && entry.address.toLowerCase() === address.toLowerCase();
                    
                    return (
                      <tr 
                        key={entry.address} 
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          isCurrentUser ? 'bg-blue-50 border-blue-200' : ''
                        } ${rank <= 3 ? `leaderboard-row rank-${rank}` : 'leaderboard-row'}`}
                      >
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getRankIcon(rank)}</span>
                            <span className={`font-bold ${getRankColor(rank)}`}>
                              #{rank}
                            </span>
                          </div>
                        </td>
                        
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-3">
                            {/* Character Image */}
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-400 shadow-lg flex-shrink-0">
                              {entry.character_image ? (
                                <img 
                                  src={entry.character_image} 
                                  alt={entry.character_name || 'Scientist'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-400 via-pink-500 to-sky-400 flex items-center justify-center">
                                  <span className="text-2xl">🧪</span>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              {/* Character Name - show default if not selected */}
                              <div className="text-xs text-purple-600 font-semibold">
                                {entry.character_name || (entry.is_vip ? '🌟 VIP Scientist' : '🧪 Scientist')}
                              </div>
                              {/* Player Username */}
                              <div className="font-bold text-gray-800 playful-text truncate">
                                {entry.nickname || `Scientist #${rank}`}
                              </div>
                              {/* Wallet Address */}
                              <div className="font-mono text-xs text-gray-500">
                                {formatAddress(entry.address)}
                              </div>
                              {/* Badges */}
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {isCurrentUser && (
                                  <Badge className="bg-blue-500 text-white text-xs">You</Badge>
                                )}
                                {entry.is_vip && (
                                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs">VIP</Badge>
                                )}
                                {!entry.selected_character && (
                                  <Badge className="bg-gray-400 text-white text-xs">No Character</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-2 text-center">
                          <div className="font-bold text-green-600 text-lg playful-text">
                            {entry.points.toLocaleString()}
                          </div>
                        </td>
                        
                        <td className="py-4 px-2 text-center">
                          <Badge variant="outline" className="font-bold">
                            Level {entry.level}
                          </Badge>
                        </td>
                        
                        <td className="py-4 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {entry.is_nft_holder && <Crown className="w-5 h-5 text-purple-500" />}
                            <Badge className={entry.is_nft_holder ? 'vip-badge' : 'bg-gray-200 text-gray-700'}>
                              {entry.is_nft_holder ? 'VIP Scientist' : 'Scientist'}
                            </Badge>
                          </div>
                        </td>
                        
                        <td className="py-4 px-2 text-right">
                          <div className="font-bold text-yellow-600">
                            {rank <= 50 ? calculateRewards(rank) : '0 LAB'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rewards Info */}
      <Card className="glass-panel mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Reward Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-2">🥇</div>
              <h3 className="font-bold text-lg text-yellow-500">Ranks 1-10</h3>
              <p className="text-sm text-gray-600">1,000 - 10,000 LAB</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">🥈</div>
              <h3 className="font-bold text-lg text-gray-400">Ranks 11-25</h3>
              <p className="text-sm text-gray-600">250 - 1,000 LAB</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">🥉</div>
              <h3 className="font-bold text-lg text-amber-600">Ranks 26-50</h3>
              <p className="text-sm text-gray-600">125 - 250 LAB</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-100 border border-blue-300 rounded-lg">
            <p className="text-blue-800 text-sm text-center">
              🎯 <strong>Remember:</strong> Only the top 50 DogeFood NFT holders are eligible for seasonal $LAB rewards!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Leaderboard;
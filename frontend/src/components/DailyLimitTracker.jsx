import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { X, Clock, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Streak tier info
const STREAK_TIERS = {
  1: { emoji: '🌱', title: 'New Chef', color: 'text-gray-300' },
  3: { emoji: '⭐', title: 'Rising Star', color: 'text-green-400' },
  5: { emoji: '🔥', title: 'Dedicated Chef', color: 'text-orange-400' },
  7: { emoji: '💪', title: 'Week Warrior', color: 'text-blue-400' },
  14: { emoji: '🏆', title: 'Lab Legend', color: 'text-purple-400' },
  30: { emoji: '👑', title: 'Master Scientist', color: 'text-yellow-400' },
};

const getStreakTier = (streak) => {
  let tier = STREAK_TIERS[1];
  for (const [threshold, tierInfo] of Object.entries(STREAK_TIERS)) {
    if (streak >= parseInt(threshold)) {
      tier = tierInfo;
    }
  }
  return tier;
};

const DailyLimitTracker = ({ playerAddress, onStatusUpdate }) => {
  const [dailyStatus, setDailyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExtraLifeModal, setShowExtraLifeModal] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [timeUntilReset, setTimeUntilReset] = useState(0);

  // Fetch daily status
  const fetchDailyStatus = useCallback(async () => {
    if (!playerAddress) return;
    
    try {
      const response = await fetch(`${API_URL}/api/daily-status/${playerAddress}`);
      if (response.ok) {
        const data = await response.json();
        setDailyStatus(data);
        setTimeUntilReset(data.time_until_reset_seconds || 0);
        if (onStatusUpdate) {
          onStatusUpdate(data);
        }
      }
    } catch (err) {
      console.error('Error fetching daily status:', err);
    } finally {
      setLoading(false);
    }
  }, [playerAddress, onStatusUpdate]);

  useEffect(() => {
    fetchDailyStatus();
  }, [fetchDailyStatus]);

  // Countdown timer
  useEffect(() => {
    if (timeUntilReset <= 0) return;
    
    const timer = setInterval(() => {
      setTimeUntilReset(prev => {
        if (prev <= 1) {
          fetchDailyStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeUntilReset, fetchDailyStatus]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handlePurchaseExtraLife = async () => {
    setPurchasing(true);
    setPurchaseResult(null);
    
    try {
      const response = await fetch(`${API_URL}/api/extra-life/${playerAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      setPurchaseResult(data);
      
      if (data.success) {
        await fetchDailyStatus();
      }
    } catch (err) {
      setPurchaseResult({ success: false, message: 'Network error.' });
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-white/10 rounded-xl p-4 h-24"></div>;
  }

  if (!dailyStatus) return null;

  const treatsInWindow = dailyStatus.treats_in_window || 0;
  const windowLimit = dailyStatus.window_limit || 4;
  const treatsToday = dailyStatus.treats_today || 0;
  const dailyLimit = dailyStatus.daily_limit || 16;
  const remaining = dailyStatus.remaining_treats || 0;
  const windowHours = dailyStatus.window_hours || 6;
  const windowProgress = (treatsInWindow / windowLimit) * 100;
  const isLimitReached = remaining === 0;
  
  const streak = dailyStatus.streak?.current_streak || 0;
  const streakBonus = dailyStatus.streak_bonus || {};
  const streakTier = getStreakTier(streak);

  return (
    <>
      {/* Limit Tracker Card */}
      <Card className={`${isLimitReached ? 'bg-gradient-to-br from-red-600/90 to-red-700/90 border-red-400/50' : 'bg-gradient-to-br from-sky-600/90 to-blue-700/90 border-sky-400/50'} backdrop-blur-xl shadow-xl`}>
        <CardContent className="p-3 sm:p-4">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{isLimitReached ? '🚫' : '🧪'}</span>
              <div>
                <h3 className="text-white font-bold text-sm">Treats</h3>
                <p className="text-sky-200 text-xs">
                  {remaining} left • {treatsToday}/{dailyLimit} today
                </p>
              </div>
            </div>
            
            {/* Streak Badge */}
            <button 
              onClick={() => setShowStreakModal(true)}
              className="flex items-center gap-1 bg-gradient-to-r from-orange-500/80 to-red-500/80 hover:from-orange-400 hover:to-red-400 px-2 py-1 rounded-full transition-all hover:scale-105"
              data-testid="streak-badge"
            >
              <span className="text-base">{streakTier.emoji}</span>
              <span className="text-white font-bold text-xs">{streak}d</span>
            </button>
          </div>
          
          {/* Window Progress */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-sky-200 mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {windowHours}h Window
              </span>
              <span>{treatsInWindow}/{windowLimit}</span>
            </div>
            <Progress value={windowProgress} className={`h-2 ${isLimitReached ? '[&>div]:bg-red-400' : ''}`} />
          </div>
          
          {/* Bottom Row */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-sky-200">
              {timeUntilReset > 0 ? (
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  Resets in {formatTime(timeUntilReset)}
                </span>
              ) : streakBonus.bonus_treats > 0 ? (
                <span className="text-green-300">🎁 +{streakBonus.bonus_treats} streak bonus</span>
              ) : (
                <span className={streakTier.color}>{streakTier.title}</span>
              )}
            </div>
            
            <Button
              onClick={() => setShowExtraLifeModal(true)}
              size="sm"
              className={`${isLimitReached 
                ? 'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-300 hover:to-red-400 animate-pulse' 
                : 'bg-white/20 hover:bg-white/30'
              } text-white text-xs h-7 px-2`}
              data-testid="buy-extra-life-btn"
            >
              ❤️ {isLimitReached ? 'Need More?' : 'Extra Life'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Streak Modal */}
      {showStreakModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-sm my-2 relative">
            <button
              onClick={() => setShowStreakModal(false)}
              className="absolute -top-1 -right-1 z-10 bg-red-500 hover:bg-red-400 rounded-full p-1.5 shadow-lg"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            
            <Card className="bg-gradient-to-b from-emerald-700 via-emerald-800 to-green-900 border-emerald-500/50 shadow-2xl">
              <CardContent className="p-4">
                <div className="text-center mb-3">
                  <div className="text-5xl mb-1">{streakTier.emoji}</div>
                  <h2 className="text-2xl font-bold text-white">{streak} Day Streak!</h2>
                  <p className={`text-sm font-semibold ${streakTier.color}`}>{streakTier.title}</p>
                </div>

                <div className="bg-black/20 rounded-lg p-3 mb-3">
                  <h3 className="text-white font-bold mb-2 text-center text-xs">Your Bonuses</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-600/30 rounded p-2">
                      <div className="text-white font-bold">+{streakBonus.bonus_treats || 0}</div>
                      <div className="text-emerald-300 text-[10px]">Treats</div>
                    </div>
                    <div className="bg-emerald-600/30 rounded p-2">
                      <div className="text-white font-bold">{((streakBonus.xp_multiplier || 1) * 100).toFixed(0)}%</div>
                      <div className="text-emerald-300 text-[10px]">XP</div>
                    </div>
                    <div className="bg-emerald-600/30 rounded p-2">
                      <div className="text-white font-bold">-{streakBonus.brewing_reduction || 0}%</div>
                      <div className="text-emerald-300 text-[10px]">Brew</div>
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 rounded-lg p-3 mb-3">
                  <h3 className="text-white font-bold mb-2 text-center text-xs">Streak Tiers</h3>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(STREAK_TIERS).map(([days, tier]) => {
                      const isAchieved = streak >= parseInt(days);
                      return (
                        <div key={days} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${isAchieved ? 'bg-emerald-500/30' : 'bg-white/5'}`}>
                          <span>{tier.emoji}</span>
                          <span className={isAchieved ? 'text-white' : 'text-white/50'}>{tier.title}</span>
                          <span className={`ml-auto ${isAchieved ? 'text-emerald-300' : 'text-white/40'}`}>{days}d</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={() => setShowStreakModal(false)} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm">
                  Keep Cooking! 🧪
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Extra Life Modal */}
      {showExtraLifeModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-sm my-2 relative">
            <button
              onClick={() => { setShowExtraLifeModal(false); setPurchaseResult(null); }}
              className="absolute -top-1 -right-1 z-10 bg-red-500 hover:bg-red-400 rounded-full p-1.5 shadow-lg"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            
            <Card className="bg-gradient-to-b from-rose-500 via-rose-600 to-red-700 border-rose-400 shadow-2xl">
              <CardContent className="p-4">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">❤️</div>
                  <h2 className="text-xl font-bold text-white">Extra Life</h2>
                  <p className="text-rose-200 text-sm">Get {dailyStatus.extra_life_treats} more treats!</p>
                </div>

                <div className="bg-black/20 rounded-lg p-3 mb-3 text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-white">Cost:</span>
                    <span className="text-yellow-300 font-bold">{dailyStatus.extra_life_cost_lab?.toLocaleString()} $LAB</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-white">You get:</span>
                    <span className="text-green-300 font-bold">+{dailyStatus.extra_life_treats} treats</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white">Current:</span>
                    <span className="text-rose-200 font-bold">{remaining} remaining</span>
                  </div>
                </div>

                {!dailyStatus.lab_token_active && (
                  <div className="bg-yellow-400/20 border border-yellow-400/50 rounded-lg p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">⚠️</span>
                      <div>
                        <h3 className="text-yellow-300 font-bold text-xs">$LAB Not Active</h3>
                        <p className="text-yellow-200 text-[10px]">Available after token launch!</p>
                      </div>
                    </div>
                  </div>
                )}

                {purchaseResult && (
                  <div className={`rounded-lg p-2 mb-3 text-xs ${purchaseResult.success ? 'bg-green-500/30' : 'bg-red-500/30'}`}>
                    <p className={purchaseResult.success ? 'text-green-300' : 'text-red-300'}>{purchaseResult.message}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={() => { setShowExtraLifeModal(false); setPurchaseResult(null); }} className="flex-1 bg-white/20 hover:bg-white/30 text-white text-sm">
                    Close
                  </Button>
                  <Button
                    onClick={handlePurchaseExtraLife}
                    disabled={purchasing || !dailyStatus.lab_token_active}
                    className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white font-bold disabled:opacity-50 text-sm"
                  >
                    {purchasing ? '⏳' : '❤️'} {dailyStatus.lab_token_active ? 'Buy' : 'Soon'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
};

export default DailyLimitTracker;

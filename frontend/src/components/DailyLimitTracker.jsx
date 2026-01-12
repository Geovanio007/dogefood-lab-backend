import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { X } from 'lucide-react';

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

  // Initial fetch
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

  // Format time remaining
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Handle extra life purchase
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
      console.error('Error purchasing extra life:', err);
      setPurchaseResult({
        success: false,
        message: 'Network error. Please try again.'
      });
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-white/10 rounded-xl p-4 h-24"></div>
    );
  }

  if (!dailyStatus) return null;

  const usedTreats = dailyStatus.treats_created_today;
  const totalLimit = dailyStatus.total_limit;
  const remaining = dailyStatus.remaining_treats;
  const progress = (usedTreats / totalLimit) * 100;
  const isLimitReached = remaining === 0;
  
  // Streak info
  const streak = dailyStatus.streak?.current_streak || 0;
  const streakBonus = dailyStatus.streak_bonus || {};
  const streakTier = getStreakTier(streak);

  return (
    <>
      {/* Combined Daily Limit & Streak Display */}
      <Card className={`${isLimitReached ? 'bg-gradient-to-br from-red-600/90 to-red-700/90 border-red-400/50' : 'bg-gradient-to-br from-sky-600/90 to-blue-700/90 border-sky-400/50'} backdrop-blur-xl shadow-xl`}>
        <CardContent className="p-4">
          {/* Top Row: Daily Treats + Streak */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{isLimitReached ? '🚫' : '🧪'}</span>
              <div>
                <h3 className="text-white font-bold text-sm">Daily Treats</h3>
                <p className="text-sky-200 text-xs">
                  {remaining} / {totalLimit} remaining
                </p>
              </div>
            </div>
            
            {/* Streak Badge - Clickable */}
            <button 
              onClick={() => setShowStreakModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500/80 to-red-500/80 hover:from-orange-400/80 hover:to-red-400/80 px-3 py-1.5 rounded-full transition-all hover:scale-105"
              data-testid="streak-badge"
            >
              <span className="text-lg">{streakTier.emoji}</span>
              <span className="text-white font-bold text-sm">{streak}</span>
              <span className="text-orange-200 text-xs">day{streak !== 1 ? 's' : ''}</span>
            </button>
          </div>
          
          {/* Progress bar */}
          <Progress 
            value={progress} 
            className={`h-3 mb-3 ${isLimitReached ? '[&>div]:bg-red-400' : ''}`}
          />
          
          {/* Bottom Row: Timer + Extra Life */}
          <div className="flex items-center justify-between">
            {/* Reset timer or streak bonus info */}
            <div className="text-xs text-sky-200">
              {streakBonus.bonus_treats > 0 ? (
                <span className="text-green-300">
                  🎁 +{streakBonus.bonus_treats} streak bonus
                </span>
              ) : timeUntilReset > 0 ? (
                <>
                  <span className="mr-1">⏱️</span>
                  Resets in {formatTime(timeUntilReset)}
                </>
              ) : (
                <span className={streakTier.color}>{streakTier.title}</span>
              )}
            </div>
            
            {/* Buy extra life button - Changed to red heart */}
            <Button
              onClick={() => setShowExtraLifeModal(true)}
              size="sm"
              className={`${isLimitReached 
                ? 'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-300 hover:to-red-400 text-white animate-pulse' 
                : 'bg-white/20 hover:bg-white/30 text-white'
              } text-xs`}
              data-testid="buy-extra-life-btn"
            >
              <span className="mr-1">❤️</span>
              {isLimitReached ? 'Need More?' : 'Extra Life'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Streak Info Modal - Dark Green Theme, Responsive */}
      {showStreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-sm bg-gradient-to-b from-emerald-700 via-emerald-800 to-green-900 border-emerald-500/50 overflow-hidden shadow-2xl relative" data-testid="streak-modal">
            {/* Close Button - Visible X */}
            <button
              onClick={() => setShowStreakModal(false)}
              className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors"
              data-testid="close-streak-modal-x"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            
            <CardContent className="p-4 sm:p-5">
              {/* Header - Compact */}
              <div className="text-center mb-4">
                <div className="text-5xl sm:text-6xl mb-2">{streakTier.emoji}</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
                  {streak} Day Streak!
                </h2>
                <p className={`text-base font-semibold ${streakTier.color} mt-1`}>
                  {streakTier.title}
                </p>
              </div>

              {/* Current Bonuses - Compact */}
              <div className="bg-black/20 rounded-xl p-3 mb-3">
                <h3 className="text-white font-bold mb-2 text-center text-sm">Your Streak Bonuses</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-600/30 rounded-lg p-2">
                    <div className="text-lg">🧪</div>
                    <div className="text-white font-bold text-sm">+{streakBonus.bonus_treats || 0}</div>
                    <div className="text-emerald-300 text-xs">Treats</div>
                  </div>
                  <div className="bg-emerald-600/30 rounded-lg p-2">
                    <div className="text-lg">⭐</div>
                    <div className="text-white font-bold text-sm">{((streakBonus.xp_multiplier || 1) * 100).toFixed(0)}%</div>
                    <div className="text-emerald-300 text-xs">XP</div>
                  </div>
                  <div className="bg-emerald-600/30 rounded-lg p-2">
                    <div className="text-lg">⚡</div>
                    <div className="text-white font-bold text-sm">-{streakBonus.brewing_reduction || 0}%</div>
                    <div className="text-emerald-300 text-xs">Brew</div>
                  </div>
                </div>
              </div>

              {/* Tier Progress - Compact */}
              <div className="bg-black/20 rounded-xl p-3 mb-4">
                <h3 className="text-white font-bold mb-2 text-center text-sm">Streak Tiers</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(STREAK_TIERS).map(([days, tier]) => {
                    const isAchieved = streak >= parseInt(days);
                    const isCurrent = streak >= parseInt(days) && (
                      Object.keys(STREAK_TIERS).indexOf(days) === Object.keys(STREAK_TIERS).length - 1 ||
                      streak < parseInt(Object.keys(STREAK_TIERS)[Object.keys(STREAK_TIERS).indexOf(days) + 1])
                    );
                    return (
                      <div 
                        key={days} 
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                          isCurrent ? 'bg-yellow-400/30 border border-yellow-400' : 
                          isAchieved ? 'bg-emerald-500/30' : 'bg-white/5'
                        }`}
                      >
                        <span className="text-base">{tier.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`truncate ${isAchieved ? 'text-white' : 'text-white/50'}`}>{tier.title}</div>
                          <div className={`${isAchieved ? 'text-emerald-300' : 'text-white/40'}`}>{days}d</div>
                        </div>
                        {isAchieved && <span className="text-green-400">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Motivational Message */}
              <div className="text-center mb-3">
                {streak === 0 ? (
                  <p className="text-emerald-200 text-sm">Create a treat to start your streak!</p>
                ) : streak < 3 ? (
                  <p className="text-emerald-200 text-sm">Keep going! 3 days unlocks bonus treats!</p>
                ) : streak < 7 ? (
                  <p className="text-emerald-200 text-sm">Amazing! Reach 7 days for Week Warrior!</p>
                ) : (
                  <p className="text-emerald-200 text-sm">You&apos;re on fire! Keep the streak alive! 🔥</p>
                )}
              </div>

              <Button
                onClick={() => setShowStreakModal(false)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold"
                data-testid="close-streak-modal-btn"
              >
                Keep Cooking! 🧪
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Extra Life Modal - Changed to red heart theme */}
      {showExtraLifeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-sm bg-gradient-to-b from-rose-500 via-rose-600 to-red-700 border-rose-400 overflow-hidden shadow-2xl relative" data-testid="extra-life-modal">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowExtraLifeModal(false);
                setPurchaseResult(null);
              }}
              className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors"
              data-testid="close-extra-life-x"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            
            <CardContent className="p-4 sm:p-5">
              {/* Header */}
              <div className="text-center mb-4">
                <div className="text-5xl sm:text-6xl mb-2">❤️</div>
                <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
                  Extra Life
                </h2>
                <p className="text-rose-200 mt-1 text-sm">
                  Get {dailyStatus.extra_life_treats} more treats today!
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-black/20 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm">Cost:</span>
                  <span className="text-yellow-300 font-bold">
                    {dailyStatus.extra_life_cost_lab.toLocaleString()} $LAB
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm">You get:</span>
                  <span className="text-green-300 font-bold">
                    +{dailyStatus.extra_life_treats} treats
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">Current:</span>
                  <span className="text-rose-200 font-bold">
                    {remaining} remaining
                  </span>
                </div>
              </div>

              {/* $LAB Not Live Warning */}
              {!dailyStatus.lab_token_active && (
                <div className="bg-yellow-400/20 border border-yellow-400/50 rounded-xl p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h3 className="text-yellow-300 font-bold text-sm">$LAB Not Active</h3>
                      <p className="text-yellow-200 text-xs mt-0.5">
                        Available after $LAB token launches!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase Result */}
              {purchaseResult && (
                <div className={`rounded-xl p-3 mb-3 ${purchaseResult.success ? 'bg-green-500/30 border border-green-400' : 'bg-red-500/30 border border-red-400'}`}>
                  <p className={`text-sm ${purchaseResult.success ? 'text-green-300' : 'text-red-300'}`}>
                    {purchaseResult.message}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowExtraLifeModal(false);
                    setPurchaseResult(null);
                  }}
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white"
                  data-testid="close-extra-life-modal-btn"
                >
                  Close
                </Button>
                <Button
                  onClick={handlePurchaseExtraLife}
                  disabled={purchasing || !dailyStatus.lab_token_active}
                  className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white font-bold disabled:opacity-50"
                  data-testid="confirm-purchase-btn"
                >
                  {purchasing ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <>
                      <span className="mr-1">❤️</span>
                      {dailyStatus.lab_token_active ? 'Buy' : 'Soon'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default DailyLimitTracker;

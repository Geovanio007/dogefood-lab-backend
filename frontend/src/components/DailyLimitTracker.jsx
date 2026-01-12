import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const DailyLimitTracker = ({ playerAddress, onStatusUpdate }) => {
  const [dailyStatus, setDailyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExtraLifeModal, setShowExtraLifeModal] = useState(false);
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
          // Refresh status when timer hits 0
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
        // Refresh status after successful purchase
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

  return (
    <>
      {/* Daily Limit Display */}
      <Card className={`${isLimitReached ? 'bg-gradient-to-br from-red-600/90 to-red-700/90 border-red-400/50' : 'bg-gradient-to-br from-sky-600/90 to-blue-700/90 border-sky-400/50'} backdrop-blur-xl shadow-xl`}>
        <CardContent className="p-4">
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
            
            {/* Extra lives badge */}
            {dailyStatus.extra_lives_purchased > 0 && (
              <Badge className="bg-yellow-400/90 text-yellow-900 text-xs">
                +{dailyStatus.extra_lives_purchased * dailyStatus.extra_life_treats} bonus
              </Badge>
            )}
          </div>
          
          {/* Progress bar */}
          <Progress 
            value={progress} 
            className={`h-3 mb-3 ${isLimitReached ? '[&>div]:bg-red-400' : ''}`}
          />
          
          <div className="flex items-center justify-between">
            {/* Reset timer */}
            {timeUntilReset > 0 && (
              <div className="text-xs text-sky-200">
                <span className="mr-1">⏱️</span>
                Resets in {formatTime(timeUntilReset)}
              </div>
            )}
            
            {/* Buy extra life button */}
            <Button
              onClick={() => setShowExtraLifeModal(true)}
              size="sm"
              className={`${isLimitReached 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white animate-pulse' 
                : 'bg-white/20 hover:bg-white/30 text-white'
              } text-xs`}
              data-testid="buy-extra-life-btn"
            >
              <span className="mr-1">💎</span>
              {isLimitReached ? 'Need More?' : 'Extra Life'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Extra Life Modal */}
      {showExtraLifeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="max-w-md w-full bg-gradient-to-b from-sky-500 via-sky-600 to-blue-700 border-sky-400 overflow-hidden shadow-2xl" data-testid="extra-life-modal">
            <CardContent className="p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">💎</div>
                <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                  Extra Life
                </h2>
                <p className="text-sky-200 mt-2">
                  Get {dailyStatus.extra_life_treats} more treats today!
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-white/10 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white">Cost:</span>
                  <span className="text-yellow-400 font-bold text-xl">
                    {dailyStatus.extra_life_cost_lab.toLocaleString()} $LAB
                  </span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white">You get:</span>
                  <span className="text-green-400 font-bold">
                    +{dailyStatus.extra_life_treats} treats
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white">Current remaining:</span>
                  <span className="text-sky-300 font-bold">
                    {remaining} treats
                  </span>
                </div>
              </div>

              {/* $LAB Not Live Warning */}
              {!dailyStatus.lab_token_active && (
                <div className="bg-yellow-400/20 border border-yellow-400/50 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h3 className="text-yellow-300 font-bold text-sm">$LAB Token Not Active</h3>
                      <p className="text-yellow-200 text-xs mt-1">
                        Extra lives will be available once $LAB token launches. Stay tuned!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase Result */}
              {purchaseResult && (
                <div className={`rounded-xl p-4 mb-4 ${purchaseResult.success ? 'bg-green-500/30 border border-green-400' : 'bg-red-500/30 border border-red-400'}`}>
                  <p className={`text-sm ${purchaseResult.success ? 'text-green-300' : 'text-red-300'}`}>
                    {purchaseResult.message}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
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
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">💎</span>
                      {dailyStatus.lab_token_active ? 'Purchase' : 'Coming Soon'}
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

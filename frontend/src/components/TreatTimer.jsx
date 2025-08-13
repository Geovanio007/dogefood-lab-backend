import React, { useState, useEffect } from 'react';
import { formatTimeRemaining, isTimerComplete } from '../config/gameConfig';

const TreatTimer = ({ 
  treatId, 
  startTime, 
  duration, 
  treatName, 
  onComplete,
  size = 'normal' // 'small', 'normal', 'large'
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const progressPercent = Math.min(100, (elapsed / duration) * 100);
      
      setTimeRemaining(remaining);
      setProgress(progressPercent);
      
      if (remaining === 0 && !isFinished) {
        setIsFinished(true);
        onComplete && onComplete(treatId);
      }
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, duration, treatId, onComplete, isFinished]);

  const sizeClasses = {
    small: 'w-16 h-20',
    normal: 'w-24 h-32',
    large: 'w-32 h-40'
  };

  const textSizeClasses = {
    small: 'text-xs',
    normal: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className="treat-timer-container">
      {/* 3D Glass Timer */}
      <div className={`treat-timer ${sizeClasses[size]} ${isFinished ? 'timer-complete' : ''}`}>
        {/* Timer Glass Body */}
        <div className="timer-glass">
          {/* Top Bulb */}
          <div className="timer-top-bulb">
            <div className="sand-remaining" style={{ height: `${100 - progress}%` }}>
              <div className="sand-surface"></div>
              <div className="sand-particles">
                <div className="particle particle-1"></div>
                <div className="particle particle-2"></div>
                <div className="particle particle-3"></div>
              </div>
            </div>
          </div>
          
          {/* Neck */}
          <div className="timer-neck">
            <div className="sand-stream" style={{ opacity: progress < 100 ? 1 : 0 }}>
              <div className="sand-drop sand-drop-1"></div>
              <div className="sand-drop sand-drop-2"></div>
            </div>
          </div>
          
          {/* Bottom Bulb */}
          <div className="timer-bottom-bulb">
            <div className="sand-collected" style={{ height: `${progress}%` }}>
              <div className="sand-surface-bottom"></div>
            </div>
          </div>
          
          {/* Glass Shine Effect */}
          <div className="glass-shine"></div>
          
          {/* Completion Sparkles */}
          {isFinished && (
            <div className="completion-sparkles">
              <div className="sparkle sparkle-1">✨</div>
              <div className="sparkle sparkle-2">⭐</div>
              <div className="sparkle sparkle-3">✨</div>
              <div className="sparkle sparkle-4">💫</div>
            </div>
          )}
        </div>
        
        {/* Timer Base */}
        <div className="timer-base">
          <div className="base-inner"></div>
          <div className="base-shine"></div>
        </div>
      </div>
      
      {/* Timer Info */}
      <div className={`timer-info ${textSizeClasses[size]}`}>
        <div className="treat-name">{treatName}</div>
        <div className={`time-display ${isFinished ? 'time-complete' : ''}`}>
          {isFinished ? (
            <span className="ready-text">🎉 Ready!</span>
          ) : (
            <span className="countdown-text">{formatTimeRemaining(timeRemaining)}</span>
          )}
        </div>
        <div className="progress-indicator">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">{Math.round(progress)}%</div>
        </div>
      </div>
    </div>
  );
};

export default TreatTimer;
import React, { useState, useEffect } from 'react';
import DogeFoodLogo from './DogeFoodLogo';

const LoadingScreen = ({ onLoadingComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setIsComplete(true);
          if (onLoadingComplete) {
            setTimeout(() => {
              onLoadingComplete();
            }, 800); // Small delay after completion
          }
          clearInterval(interval);
          return 100;
        }
        // Smooth progress increase with slight randomness for realistic feel
        return prev + Math.random() * 3 + 1;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [onLoadingComplete]);

  return (
    <div className="loading-screen">
      {/* Animated Background */}
      <div className="loading-bg">
        <div className="bubble bubble-1"></div>
        <div className="bubble bubble-2"></div>
        <div className="bubble bubble-3"></div>
        <div className="bubble bubble-4"></div>
        <div className="bubble bubble-5"></div>
      </div>

      {/* Main Content */}
      <div className="loading-content">
        {/* New Logo */}
        <div className="loading-logo flex justify-center mb-8">
          <DogeFoodLogo 
            size="large" 
            showText={true} 
            showBeta={false}
            className="animate-pulse"
            textClassName="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500"
          />
        </div>
          <p className="loading-subtitle">
            Preparing your laboratory... 🔬
          </p>
        </div>

        {/* Thermometer Container */}
        <div className="thermometer-container">
          {/* Thermometer Base */}
          <div className="thermometer">
            {/* Thermometer Tube */}
            <div className="thermometer-tube">
              <div className="thermometer-scale">
                <div className="scale-line scale-0">0°</div>
                <div className="scale-line scale-25">25°</div>
                <div className="scale-line scale-50">50°</div>
                <div className="scale-line scale-75">75°</div>
                <div className="scale-line scale-100">100°</div>
              </div>
              
              {/* Liquid Fill */}
              <div className="liquid-container">
                <div 
                  className="liquid-fill"
                  style={{ height: `${progress}%` }}
                >
                  <div className="liquid-surface"></div>
                  <div className="bubble-inside bubble-inside-1"></div>
                  <div className="bubble-inside bubble-inside-2"></div>
                  <div className="bubble-inside bubble-inside-3"></div>
                </div>
              </div>
            </div>
            
            {/* Thermometer Bulb */}
            <div className="thermometer-bulb">
              <div className="bulb-inner"></div>
              <div className="bulb-shine"></div>
            </div>
          </div>
          
          {/* Labels */}
          <div className="thermometer-label">Laboratory Temperature</div>
        </div>

        {/* Progress Text */}
        <div className="progress-text">
          <div className="progress-percentage">{Math.round(progress)}%</div>
          <div className="progress-bar-container">
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          <div className="loading-message">
            {progress < 30 && "Mixing ingredients..."}
            {progress >= 30 && progress < 60 && "Heating laboratory..."}
            {progress >= 60 && progress < 90 && "Calibrating equipment..."}
            {progress >= 90 && progress < 100 && "Almost ready..."}
            {progress >= 100 && isComplete && "Laboratory ready! 🎉"}
          </div>
        </div>

        {/* Completion Animation */}
        {isComplete && (
          <div className="completion-animation">
            <div className="success-icon">✨</div>
            <div className="success-text">Welcome to the Lab!</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
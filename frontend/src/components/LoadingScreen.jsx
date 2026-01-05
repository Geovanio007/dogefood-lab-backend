import React, { useState, useEffect } from 'react';
import DogeFoodLogo from './DogeFoodLogo';

const LAB_TOKEN_URL = "https://customer-assets.emergentagent.com/job_doge-treats/artifacts/bihai5rz_1000081758-removebg-preview.png";

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
            }, 800);
          }
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 3 + 1;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [onLoadingComplete]);

  // Generate falling token positions
  const fallingTokens = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: `${5 + (i * 8)}%`,
    delay: `${i * 0.15}s`,
    duration: `${1.5 + Math.random() * 1}s`,
    size: `${30 + Math.random() * 25}px`
  }));

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
            showText={false} 
            showBeta={false}
            className="animate-pulse"
          />
        </div>
        
        <div>
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
            {progress >= 100 && isComplete && "Laboratory ready!"}
          </div>
        </div>

        {/* Completion Animation with $LAB Tokens */}
        {isComplete && (
          <div className="completion-animation relative">
            {/* Falling $LAB Tokens */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
              {fallingTokens.map((token) => (
                <img
                  key={token.id}
                  src={LAB_TOKEN_URL}
                  alt="$LAB"
                  className="absolute animate-fall-splash"
                  style={{
                    left: token.left,
                    top: '-50px',
                    width: token.size,
                    height: token.size,
                    animationDelay: token.delay,
                    animationDuration: token.duration,
                    filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))'
                  }}
                />
              ))}
            </div>
            
            {/* Central $LAB Token with splash effect */}
            <div className="success-icon relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-ping absolute">
                  <img 
                    src={LAB_TOKEN_URL} 
                    alt="$LAB" 
                    className="w-16 h-16 opacity-50"
                  />
                </div>
              </div>
              <img 
                src={LAB_TOKEN_URL} 
                alt="$LAB" 
                className="w-16 h-16 animate-bounce relative z-10"
                style={{ filter: 'drop-shadow(0 0 15px rgba(255, 215, 0, 0.8))' }}
              />
            </div>
            <div className="success-text mt-4">Welcome to the Lab!</div>
          </div>
        )}
      </div>

      {/* Custom styles for falling animation */}
      <style jsx>{`
        @keyframes fall-splash {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          70% {
            transform: translateY(80vh) rotate(360deg) scale(1);
            opacity: 1;
          }
          85% {
            transform: translateY(85vh) rotate(380deg) scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: translateY(100vh) rotate(400deg) scale(0.5);
            opacity: 0;
          }
        }
        
        .animate-fall-splash {
          animation: fall-splash ease-in forwards;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import DogeFoodLogo from './DogeFoodLogo';

const WelcomeScreen = ({ onPlayNow }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`welcome-screen min-h-screen flex items-center justify-center relative overflow-hidden ${
      isDarkMode ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900' : 'bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100'
    }`}>
      
      {/* Background Pattern/Texture */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full bg-repeat" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='7' cy='7' r='2'/%3E%3Ccircle cx='37' cy='17' r='1'/%3E%3Ccircle cx='47' cy='37' r='2'/%3E%3Ccircle cx='17' cy='47' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      {/* Main Content Container */}
      <div className="welcome-content relative z-10 text-center max-w-4xl mx-auto px-8">
        
        {/* Title Section with Logo Only */}
        <div className="mb-12 animate-bounce-slow">
          <div className="flex justify-center mb-6">
            <DogeFoodLogo 
              size="hero" 
              showText={false} 
              showBeta={false}
              className="animate-pulse"
            />
          </div>
          
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="text-6xl animate-spin-slow">🧪</div>
            <h2 className={`welcome-subtitle text-4xl md:text-5xl font-bold ${
              isDarkMode ? 'text-cyan-200' : 'text-orange-700'
            }`}>
              Adventure
            </h2>
            <div className="text-6xl animate-bounce">🐕</div>
          </div>
        </div>

        {/* Description */}
        <div className={`welcome-description mb-12 text-2xl md:text-3xl font-semibold ${
          isDarkMode ? 'text-blue-100' : 'text-orange-800'
        }`}>
          <p className="mb-4">🎮 Mix Magical Dogetreats</p>
          <p className="mb-4">🏆 Compete with VIP Scientists</p>
          <p className="mb-4">💎 Earn $LAB Tokens</p>
          <p className="text-xl opacity-80">Ready to become the ultimate treat creator?</p>
        </div>

        {/* Play Now Button - Original Design Restored */}
        <div className="welcome-button-container mb-8 flex justify-center items-center">
          <button
            onClick={() => {
              console.log('PLAY NOW button clicked!');
              onPlayNow();
            }}
            className="play-now-button group relative inline-flex items-center justify-center cursor-pointer"
            style={{ zIndex: 50 }}
          >
            {/* Button Background with Glow - Sky Blue Theme */}
            <div className="absolute inset-0 rounded-full transition-all duration-300 group-hover:scale-110 bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 shadow-2xl shadow-sky-500/50"></div>
            
            {/* Button Content */}
            <div className="relative z-10 px-16 py-6 flex items-center gap-4">
              <div className="text-6xl">🚀</div>
              <span className="text-4xl md:text-5xl font-black text-yellow-400">
                PLAY NOW
              </span>
              <div className="text-6xl animate-pulse">✨</div>
            </div>

            {/* Hover Effect Ring - Sky Blue */}
            <div className="absolute inset-0 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:scale-125 border-4 border-sky-300 shadow-lg shadow-sky-300/30"></div>
          </button>

          {/* Pulsing Effect - Sky Blue */}
          <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-sky-400" style={{ animationDuration: '2s' }}></div>
        </div>

        {/* Bottom Tagline */}
        <div className={`mt-16 text-lg opacity-75 ${
          isDarkMode ? 'text-blue-200' : 'text-orange-600'
        }`}>
          <p>🌟 Web3 Gaming • NFT Rewards • DeFi Integration 🌟</p>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="floating-elements absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 text-4xl animate-float opacity-60">🧬</div>
        <div className="absolute top-40 right-32 text-5xl animate-float-delayed opacity-60">⚗️</div>
        <div className="absolute bottom-32 left-40 text-4xl animate-float opacity-60">🔬</div>
        <div className="absolute bottom-20 right-20 text-5xl animate-float-delayed opacity-60">🧪</div>
        <div className="absolute top-1/2 left-20 text-3xl animate-float opacity-40">💊</div>
        <div className="absolute top-1/3 right-16 text-3xl animate-float-delayed opacity-40">🧫</div>
      </div>

      {/* Beta Badge */}
      <div className="absolute top-8 right-8">
        <div className={`px-6 py-3 rounded-full font-bold text-lg ${
          isDarkMode 
            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30' 
            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
        }`}>
          BETA v1.0
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
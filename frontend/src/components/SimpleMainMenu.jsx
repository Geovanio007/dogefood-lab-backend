import React from 'react';
import { Link } from 'react-router-dom';

const SimpleMainMenu = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Background Lab Scene - Subtle */}
      <div className="absolute inset-0 opacity-5">
        <img 
          src="https://images.unsplash.com/photo-1578272018819-412aef6cb45d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxsYWJvcmF0b3J5JTIwZXF1aXBtZW50JTIwY29sb3JmdWx8ZW58MHx8fHwxNzU0OTQ2OTAwfDA&ixlib=rb-4.1.0&q=85"
          alt="Lab Background" 
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Main Container */}
      <div className="relative z-10 container mx-auto px-6 py-8">
        
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4" style={{ color: '#FFD700' }}>
            🧪 DogeFood Lab
          </h1>
          <div className="mb-6">
            <span className="inline-block px-4 py-2 rounded-full text-white font-bold text-sm" style={{ backgroundColor: '#4285f4' }}>
              BETA
            </span>
          </div>
          <p className="text-2xl font-semibold mb-8" style={{ color: '#B57B2E' }}>
            Mix, Test & Upgrade Your Way to the Top! 🚀
          </p>
          
          {/* Connect Wallet Button */}
          <button 
            className="px-8 py-3 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            style={{ backgroundColor: '#FFD700' }}
          >
            Connect Wallet
          </button>
        </div>

        {/* Main Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-6xl mx-auto">
          {/* Enter Lab Card */}
          <Link to="/lab">
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer" style={{ borderColor: '#FFD700' }}>
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: '#FFD700' }}
              >
                <span className="text-4xl">🧪</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: '#B57B2E' }}>
                Enter Lab
              </h3>
              <p className="text-gray-600 text-center mb-6 leading-relaxed">
                Start mixing magical Dogetreats and unlock new recipes!
              </p>
              <button 
                className="w-full py-3 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all duration-200"
                style={{ backgroundColor: '#FFD700' }}
              >
                Start Mixing 🧪
              </button>
            </div>
          </Link>

          {/* My Treats Card */}
          <Link to="/nfts">
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer" style={{ borderColor: '#FFD700' }}>
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: '#FFD700' }}
              >
                <span className="text-4xl">🎨</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: '#B57B2E' }}>
                My Treats
              </h3>
              <p className="text-gray-600 text-center mb-6 leading-relaxed">
                View your created Dogetreats and rare collections!
              </p>
              <button 
                className="w-full py-3 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all duration-200"
                style={{ backgroundColor: '#FFD700' }}
              >
                View Collection 🎨
              </button>
            </div>
          </Link>

          {/* Leaderboard Card */}
          <Link to="/leaderboard">
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer" style={{ borderColor: '#FFD700' }}>
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: '#FFD700' }}
              >
                <span className="text-4xl">🏆</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: '#B57B2E' }}>
                Leaderboard
              </h3>
              <p className="text-gray-600 text-center mb-6 leading-relaxed">
                Compete with other VIP Scientists for $LAB rewards!
              </p>
              <button 
                className="w-full py-3 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all duration-200"
                style={{ backgroundColor: '#FFD700' }}
              >
                View Rankings 🏆
              </button>
            </div>
          </Link>
        </div>

        {/* Character Section */}
        <div className="text-center mb-16">
          <img 
            src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png" 
            alt="Doge Scientist" 
            className="mx-auto w-64 h-64 object-contain"
          />
        </div>

        {/* Welcome Section */}
        <div className="bg-white rounded-2xl shadow-xl p-12 mb-12 max-w-6xl mx-auto border-2" style={{ borderColor: '#FFD700' }}>
          <h2 className="text-4xl font-bold text-center mb-8" style={{ color: '#FFD700' }}>
            Welcome to DogeFood Lab! 🐕‍🦺
          </h2>
          
          {/* Powered by DogeOS */}
          <div className="text-center mb-12">
            <h3 className="text-xl font-bold mb-6" style={{ color: '#B57B2E' }}>Powered by</h3>
            <img 
              src="https://customer-assets.emergentagent.com/job_dogefoodlab/artifacts/ckey490s_20250812_154617.jpg" 
              alt="Powered by DOGEOS" 
              className="mx-auto max-w-xs rounded-lg shadow-md"
            />
          </div>

          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold mb-4" style={{ color: '#FFD700' }}>
              Connect Your Wallet to Get Started! 🔗
            </h3>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="text-center">
              <h4 className="text-2xl font-bold mb-6" style={{ color: '#FFD700' }}>
                For Everyone 🎮
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#B6E57D' }}></span>
                  <span className="text-gray-700">Play for fun & advance levels</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#B6E57D' }}></span>
                  <span className="text-gray-700">Mix unlimited Dogetreats</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#B6E57D' }}></span>
                  <span className="text-gray-700">Unlock new ingredients</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#B6E57D' }}></span>
                  <span className="text-gray-700">Enjoy the full experience!</span>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <h4 className="text-2xl font-bold mb-6" style={{ color: '#FFD700' }}>
                For NFT Holders ⭐
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFD700' }}></span>
                  <span className="text-gray-700">Head start with bonus resources</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFD700' }}></span>
                  <span className="text-gray-700">Earn points for leaderboard</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFD700' }}></span>
                  <span className="text-gray-700">Eligible for $LAB airdrops</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFD700' }}></span>
                  <span className="text-gray-700">VIP Scientist status!</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-lg" style={{ color: '#B57B2E' }}>
            Built with ❤️ for the Dogecoin community • Much wow, such science! 🌙
          </p>
          
          {/* Made with Emergent Badge */}
          <div className="mt-8">
            <a 
              href="https://app.emergent.sh/?utm_source=emergent-badge" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              <img 
                src="https://avatars.githubusercontent.com/in/1201222?s=120&u=2686cf91179bbafbc7a71bfbc43004cf9ae1acea&v=4" 
                alt="Emergent"
                className="w-8 h-8 rounded-full"
              />
              <span className="text-gray-700 font-medium">Made with Emergent</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleMainMenu;
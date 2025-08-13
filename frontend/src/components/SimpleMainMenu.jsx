import React from 'react';
import { Link } from 'react-router-dom';

const SimpleMainMenu = () => {
  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Background Lab Scene */}
      <div className="absolute inset-0 opacity-10">
        <img 
          src="https://images.unsplash.com/photo-1578272018819-412aef6cb45d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxsYWJvcmF0b3J5JTIwZXF1aXBtZW50JTIwY29sb3JmdWx8ZW58MHx8fHwxNzU0OTQ2OTAwfDA&ixlib=rb-4.1.0&q=85"
          alt="Lab Background" 
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="text-white text-center max-w-6xl mx-auto p-8">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-7xl font-bold mb-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 bg-clip-text text-transparent">
              🧪 DogeFood Lab
            </h1>
            <div className="mb-4">
              <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-lg font-bold">
                BETA
              </span>
            </div>
            <p className="text-2xl text-gray-200">Mix, Test & Upgrade Your Way to the Top! 🚀</p>
          </div>

          {/* Wallet Connection */}
          <div className="mb-12">
            <button className="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl px-8 py-4 rounded-xl text-white font-bold hover:bg-white/30 transition-all duration-200">
              Connect Wallet
            </button>
          </div>

          {/* Main Menu Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Enter Lab */}
            <Link to="/lab" className="block">
              <div className="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-xl p-8 transition-all duration-300 hover:scale-105 hover:bg-white/30 cursor-pointer">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-6">
                  <span className="text-5xl">🧪</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Enter Lab</h3>
                <p className="text-gray-200 mb-6">Start mixing magical Dogetreats and unlock new recipes!</p>
                <button className="w-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105">
                  Start Mixing 🧪
                </button>
              </div>
            </Link>

            {/* My Treats */}
            <Link to="/nfts" className="block">
              <div className="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-xl p-8 transition-all duration-300 hover:scale-105 hover:bg-white/30 cursor-pointer">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-6">
                  <span className="text-5xl">🎨</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">My Treats</h3>
                <p className="text-gray-200 mb-6">View your created Dogetreats and rare collections!</p>
                <button className="w-full bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105">
                  View Collection 🎨
                </button>
              </div>
            </Link>

            {/* Leaderboard */}
            <Link to="/leaderboard" className="block">
              <div className="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-xl p-8 transition-all duration-300 hover:scale-105 hover:bg-white/30 cursor-pointer">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-6">
                  <span className="text-5xl">🏆</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Leaderboard</h3>
                <p className="text-gray-200 mb-6">Compete with other VIP Scientists for $LAB rewards!</p>
                <button className="w-full bg-gradient-to-r from-green-400 via-green-500 to-green-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105">
                  View Rankings 🏆
                </button>
              </div>
            </Link>
          </div>

          {/* Character Section */}
          <div className="mb-12">
            <img 
              src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png" 
              alt="Doge Scientist" 
              className="mx-auto w-48 h-48 object-contain"
            />
          </div>

          {/* Welcome Section */}
          <div className="bg-white/20 backdrop-blur-md border border-white/30 shadow-xl rounded-xl p-8 mb-8">
            <h2 className="text-3xl font-bold mb-4 text-white">Welcome to DogeFood Lab! 🐕‍🦺</h2>
            
            {/* Powered by DogeOS */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4">Powered by</h3>
              <img 
                src="https://customer-assets.emergentagent.com/job_dogefoodlab/artifacts/ckey490s_20250812_154617.jpg" 
                alt="Powered by DOGEOS" 
                className="mx-auto max-w-sm rounded-lg"
              />
            </div>

            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-4">Connect Your Wallet to Get Started! 🔗</h3>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div>
                <h4 className="text-xl font-bold mb-4 text-yellow-400">For Everyone 🎮</h4>
                <ul className="space-y-2 text-gray-200">
                  <li>• Play for fun & advance levels</li>
                  <li>• Mix unlimited Dogetreats</li>
                  <li>• Unlock new ingredients</li>
                  <li>• Enjoy the full experience!</li>
                </ul>
              </div>
              <div>
                <h4 className="text-xl font-bold mb-4 text-purple-400">For NFT Holders ⭐</h4>
                <ul className="space-y-2 text-gray-200">
                  <li>• Head start with bonus resources</li>
                  <li>• Earn points for leaderboard</li>
                  <li>• Eligible for $LAB airdrops</li>
                  <li>• VIP Scientist status!</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-300">
            <p>Built with ❤️ for the Dogecoin community • Much wow, such science! 🌙</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleMainMenu;
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const MainMenu = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);

  const connectWallet = async () => {
    // Mock wallet connection for prototype
    const mockAddress = '0x1234567890123456789012345678901234567890';
    setAddress(mockAddress);
    setIsConnected(true);
  };

  const disconnectWallet = () => {
    setAddress(null);
    setIsConnected(false);
  };

  return (
    <div className="lab-container min-h-screen p-8">
      {/* Background Lab Scene */}
      <div className="absolute inset-0 opacity-10">
        <img
          src="https://images.unsplash.com/photo-1578272018819-412aef6cb45d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxsYWJvcmF0b3J5JTIwZXF1aXBtZW50JTIwY29sb3JmdWx8ZW58MHx8fHwxNzU0OTQ2OTAwfDA&ixlib=rb-4.1.0&q=85"
          alt="Lab Background"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-6xl font-bold">
                <span className="doge-gradient">
                  DogeFood Lab
                </span>
                <span className="ml-3 text-5xl">🧪</span>
              </h1>
              <div className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full font-bold">
                BETA
              </div>
            </div>
            <p className="text-xl text-gray-800 font-semibold drop-shadow-md">
              Mix, Test & Upgrade Your Way to the Top! 🚀
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isConnected && (
              <div className="flex items-center gap-2">
                <div className="glass-panel p-3">
                  <div className="text-sm text-gray-600">Level 1</div>
                  <div className="font-bold text-lg">0 Points</div>
                </div>
              </div>
            )}
            <button
              onClick={isConnected ? disconnectWallet : connectWallet}
              className="doge-button"
            >
              {isConnected ? `${address?.slice(0,6)}...${address?.slice(-4)}` : 'Connect Wallet'}
            </button>
          </div>
        </div>

        {/* Main Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* Enter Lab */}
          <div className="glass-panel hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/lab">
              <div className="text-center p-6">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">🧪</span>
                </div>
                <h3 className="text-2xl doge-gradient font-bold mb-4">Enter Lab</h3>
                <p className="text-gray-600 mb-4">
                  Start mixing magical Dogetreats and unlock new recipes!
                </p>
                <button className="doge-button w-full">
                  Start Mixing 🧪
                </button>
              </div>
            </Link>
          </div>

          {/* My NFTs */}
          <div className="glass-panel hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/nfts">
              <div className="text-center p-6">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">🎨</span>
                </div>
                <h3 className="text-2xl doge-gradient font-bold mb-4">My Treats</h3>
                <p className="text-gray-600 mb-4">
                  View your created Dogetreats and rare collections!
                </p>
                <button className="doge-button w-full">
                  View Collection 🎨
                </button>
              </div>
            </Link>
          </div>

          {/* Leaderboard */}
          <div className="glass-panel hover:scale-105 transition-all duration-300 cursor-pointer">
            <Link to="/leaderboard">
              <div className="text-center p-6">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">🏆</span>
                </div>
                <h3 className="text-2xl doge-gradient font-bold mb-4">Leaderboard</h3>
                <p className="text-gray-600 mb-4">
                  Compete with other VIP Scientists for $LAB rewards!
                </p>
                <button className="doge-button w-full">
                  View Rankings 🏆
                </button>
              </div>
            </Link>
          </div>
        </div>

        {/* Doge Scientist Avatar */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <img
              src="https://i.ibb.co/hJQcdpfM/1000025492-removebg-preview.png"
              alt="Doge Scientist"
              className="w-40 h-40 rounded-full border-4 border-yellow-400 shadow-2xl hover:scale-110 transition-transform duration-300 bg-white/20 backdrop-blur-sm"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mt-4">
            Welcome to DogeFood Lab! 🐕‍🦺
          </h3>
        </div>

        {/* Powered By Banner Section */}
        <div className="text-center mb-12">
          <h4 className="text-lg font-semibold text-gray-700 mb-6">
            Powered by
          </h4>
          <div className="max-w-3xl mx-auto px-4">
            <img
              src="https://customer-assets.emergentagent.com/job_dogefoodlab/artifacts/ckey490s_20250812_154617.jpg"
              alt="Powered by DOGEOS"
              className="w-full h-auto rounded-xl shadow-lg border-2 border-yellow-400 hover:scale-105 transition-transform duration-300 bg-white/10 backdrop-blur-sm"
              style={{
                maxWidth: '600px',
                margin: '0 auto'
              }}
            />
          </div>
        </div>

        {/* Benefits Section */}
        {!isConnected && (
          <div className="glass-panel">
            <div className="p-6">
              <h3 className="text-center doge-gradient text-2xl font-bold mb-6">
                Connect Your Wallet to Get Started! 🔗
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center p-4 bg-white/20 rounded-xl">
                  <h4 className="font-bold text-lg mb-2">For Everyone 🎮</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Play for fun & advance levels</li>
                    <li>• Mix unlimited Dogetreats</li>
                    <li>• Unlock new ingredients</li>
                    <li>• Enjoy the full experience!</li>
                  </ul>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl">
                  <h4 className="font-bold text-lg mb-2">For NFT Holders ⭐</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Head start with bonus resources</li>
                    <li>• Earn points for leaderboard</li>
                    <li>• Eligible for $LAB airdrops</li>
                    <li>• VIP Scientist status!</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-gray-500 text-sm">
            Built with ❤️ for the Dogecoin community • Much wow, such science! 🌙
          </p>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
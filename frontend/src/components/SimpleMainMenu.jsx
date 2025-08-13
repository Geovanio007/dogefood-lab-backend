import React from 'react';
import { Link } from 'react-router-dom';

const SimpleMainMenu = () => {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Hero Background Image - Full width at top */}
      <div className="relative w-full h-80 mb-8">
        <img 
          src="https://images.unsplash.com/photo-1578272018819-412aef6cb45d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxsYWJvcmF0b3J5JTIwZXF1aXBtZW50JTIwY29sb3JmdWx8ZW58MHx8fHwxNzU0OTQ2OTAwfDA&ixlib=rb-4.1.0&q=85"
          alt="Lab Background" 
          className="w-full h-full object-cover"
        />
        
        {/* Header Content Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col justify-center items-center text-white">
          <h1 className="text-6xl font-bold mb-2" style={{ color: '#FFD700' }}>
            DogeFood Lab🧪
          </h1>
          <div className="mb-4">
            <span className="inline-block px-3 py-1 rounded-full text-white font-bold text-sm bg-blue-500">
              BETA
            </span>
          </div>
          <p className="text-xl font-medium mb-6">
            Mix, Test & Upgrade Your Way to the Top! 🚀
          </p>
          
          {/* Connect Wallet Button */}
          <button 
            className="px-6 py-3 rounded-lg text-black font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            style={{ backgroundColor: '#FFD700' }}
          >
            Connect Wallet
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="container mx-auto px-6 max-w-6xl">
        
        {/* Three Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Enter Lab Card */}
          <Link to="/lab" className="group">
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 text-center shadow-md hover:shadow-lg transition-all duration-200 hover:border-yellow-400 group-hover:scale-105">
              <h3 className="text-xl font-bold mb-2" style={{ color: '#FFD700' }}>
                Enter Lab
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                Start mixing magical Dogetreats and unlock new recipes!
              </p>
              <button 
                className="w-full py-2 px-4 rounded-lg text-black font-semibold transition-colors"
                style={{ backgroundColor: '#FFD700' }}
              >
                Start Mixing 🧪
              </button>
            </div>
          </Link>

          {/* My Treats Card */}
          <Link to="/nfts" className="group">
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 text-center shadow-md hover:shadow-lg transition-all duration-200 hover:border-yellow-400 group-hover:scale-105">
              <h3 className="text-xl font-bold mb-2" style={{ color: '#FFD700' }}>
                My Treats
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                View your created Dogetreats and rare collections!
              </p>
              <button 
                className="w-full py-2 px-4 rounded-lg text-black font-semibold transition-colors"
                style={{ backgroundColor: '#FFD700' }}
              >
                View Collection 🎨
              </button>
            </div>
          </Link>

          {/* Leaderboard Card */}
          <Link to="/leaderboard" className="group">
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 text-center shadow-md hover:shadow-lg transition-all duration-200 hover:border-yellow-400 group-hover:scale-105">
              <h3 className="text-xl font-bold mb-2" style={{ color: '#FFD700' }}>
                Leaderboard
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                Compete with other VIP Scientists for $LAB rewards!
              </p>
              <button 
                className="w-full py-2 px-4 rounded-lg text-black font-semibold transition-colors"
                style={{ backgroundColor: '#FFD700' }}
              >
                View Rankings 🏆
              </button>
            </div>
          </Link>
        </div>

        {/* Doge Scientist Character */}
        <div className="text-center mb-12">
          <img 
            src="https://i.ibb.co/hJQcdpfM/1000025492-removebg-preview.png" 
            alt="Doge Scientist" 
            className="mx-auto w-48 h-48 object-contain"
          />
        </div>

        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-8" style={{ color: '#FFD700' }}>
            Welcome to DogeFood Lab! 🐕‍🦺
          </h2>
          
          {/* Powered by DogeOS */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#B57B2E' }}>
              Powered by
            </h3>
            <img 
              src="https://customer-assets.emergentagent.com/job_dogefoodlab/artifacts/ckey490s_20250812_154617.jpg" 
              alt="Powered by DOGEOS" 
              className="mx-auto max-w-xs h-auto"
            />
          </div>

          <h3 className="text-xl font-bold mb-8" style={{ color: '#FFD700' }}>
            Connect Your Wallet to Get Started! 🔗
          </h3>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* For Everyone */}
            <div className="text-left">
              <h4 className="text-xl font-bold mb-4" style={{ color: '#FFD700' }}>
                For Everyone 🎮
              </h4>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-center">
                  <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#B6E57D' }}></span>
                  Play for fun & advance levels
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#B6E57D' }}></span>
                  Mix unlimited Dogetreats
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#B6E57D' }}></span>
                  Unlock new ingredients
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#B6E57D' }}></span>
                  Enjoy the full experience!
                </li>
              </ul>
            </div>

            {/* For NFT Holders */}
            <div className="text-left">
              <h4 className="text-xl font-bold mb-4" style={{ color: '#FFD700' }}>
                For NFT Holders ⭐
              </h4>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-center">
                  <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#FFD700' }}></span>
                  Head start with bonus resources
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#FFD700' }}></span>
                  Earn points for leaderboard
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#FFD700' }}></span>
                  Eligible for $LAB airdrops
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: '#FFD700' }}></span>
                  VIP Scientist status!
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mb-8">
          <p className="text-lg mb-6" style={{ color: '#B57B2E' }}>
            Built with ❤️ for the Dogecoin community • Much wow, such science! 🌙
          </p>
          
          {/* Made with Emergent Badge */}
          <a 
            href="https://app.emergent.sh/?utm_source=emergent-badge" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <img 
              src="https://avatars.githubusercontent.com/in/1201222?s=120&u=2686cf91179bbafbc7a71bfbc43004cf9ae1acea&v=4" 
              alt="Emergent"
              className="w-6 h-6 rounded-full"
            />
            <span className="text-gray-700 font-medium text-sm">Made with Emergent</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default SimpleMainMenu;
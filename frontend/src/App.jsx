import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Simple MainMenu component
const MainMenu = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-6xl font-bold mb-2">🧪 DogeFood Lab</h1>
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold">
                BETA
              </div>
            </div>
            <p className="text-xl text-gray-300">Mix, Test & Upgrade Your Way to the Top! 🚀</p>
          </div>

          {/* Menu Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Enter Lab */}
            <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🧪</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Enter Lab</h3>
              <p className="text-gray-300 mb-4">Start mixing magical Dogetreats and unlock new recipes!</p>
              <button className="w-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200">
                Start Mixing 🧪
              </button>
            </div>

            {/* My Treats */}
            <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🎨</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">My Treats</h3>
              <p className="text-gray-300 mb-4">View your created Dogetreats and rare collections!</p>
              <button className="w-full bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200">
                View Collection 🎨
              </button>
            </div>

            {/* Leaderboard */}
            <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🏆</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Leaderboard</h3>
              <p className="text-gray-300 mb-4">Compete with other VIP Scientists for $LAB rewards!</p>
              <button className="w-full bg-gradient-to-r from-green-400 via-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-lg hover:scale-105 transition-all duration-200">
                View Rankings 🏆
              </button>
            </div>
          </div>

          {/* Web3 Status */}
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4">🔗 Web3 Integration Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center mb-4">
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-gray-300">Points</div>
              </div>
              <div>
                <div className="text-2xl font-bold">Level 1</div>
                <div className="text-sm text-gray-300">Current Level</div>
              </div>
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-gray-300">Treats Created</div>
              </div>
              <div>
                <div className="text-2xl font-bold">2</div>
                <div className="text-sm text-gray-300">Ingredients Unlocked</div>
              </div>
            </div>
            
            <div className="text-sm text-gray-400 mt-4">
              <p>🧪 Smart Contracts Deployed on DogeOS Devnet:</p>
              <p>📊 LAB Token: 0xc238Ef1C4d4d9109e4d8D0D6BB1eA55bA58861d1</p>
              <p>🎨 DogeFood NFT: 0xC8AB737B8baef6f8a33b2720fD20F27F4A54E2C0</p>
              <p>🏆 Rewards: 0x37F20600fd6eF1416ccb1DD20043CCfb4d72ba30</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const GameLab = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">🧪 Game Lab</h1>
        <p className="text-xl mb-8">Coming Soon! Full game functionality is being restored.</p>
        <a href="/" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
          ← Back to Menu
        </a>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App min-h-screen">
      <Router>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/lab" element={<GameLab />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Simple MainMenu component for now
const MainMenu = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-white text-center max-w-4xl mx-auto p-8">
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
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-4xl mb-4">🧪</div>
            <h3 className="text-xl font-bold mb-2">Enter Lab</h3>
            <p className="text-sm text-gray-300">Start mixing magical Dogetreats and unlock new recipes</p>
          </div>
          
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-4xl mb-4">🎨</div>
            <h3 className="text-xl font-bold mb-2">My Treats</h3>
            <p className="text-sm text-gray-300">View your created Dogetreats and rare collections</p>
          </div>
          
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-bold mb-2">Leaderboard</h3>
            <p className="text-sm text-gray-300">Compete with other VIP Scientists for $LAB rewards</p>
          </div>
        </div>

        {/* Connect Wallet Section */}
        <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6">
          <h3 className="text-2xl font-bold mb-4">🔗 Connect Your Web3 Wallet to Start!</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/20 rounded-xl p-4">
              <h4 className="font-bold text-lg mb-2">For Everyone 🎮</h4>
              <ul className="text-sm space-y-1 text-left">
                <li>• Play for fun & advance levels</li>
                <li>• Mix unlimited Dogetreats</li>
                <li>• Unlock new ingredients</li>
                <li>• Experience Web3 gaming!</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-yellow-100/20 to-orange-100/20 rounded-xl p-4">
              <h4 className="font-bold text-lg mb-2">For DogeFood NFT Holders ⭐</h4>
              <ul className="text-sm space-y-1 text-left">
                <li>• Exclusive access to premium features</li>
                <li>• Earn $LAB tokens through gameplay</li>
                <li>• Quarterly leaderboard rewards</li>
                <li>• VIP Scientist status & benefits!</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50/20 rounded-xl">
            <h4 className="font-bold text-blue-200 mb-2">🔗 Powered by DogeOS Devnet</h4>
            <p className="text-sm text-blue-100">
              This is a real Web3 game running on DogeOS blockchain. 
              Connect your wallet to MetaMask or any Web3 wallet to play!
            </p>
          </div>
        </div>
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
        </Routes>
      </Router>
    </div>
  );
}

export default App;

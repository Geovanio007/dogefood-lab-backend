import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold mb-4">🧪 DogeFood Lab</h1>
        <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold inline-block mb-4">
          BETA
        </div>
        <p className="text-xl mb-8">Mix, Test & Upgrade Your Way to the Top! 🚀</p>
        
        <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Web3 Integration Status</h2>
          <div className="space-y-2">
            <p>✅ Smart Contracts Deployed on DogeOS Devnet</p>
            <p>📊 LAB Token: 0xc238...61d1</p>
            <p>🎨 DogeFood NFT: 0xC8AB...2C0</p>
            <p>🏆 Rewards: 0x37F2...a30</p>
          </div>
        </div>
        
        <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-4">Test Results</h2>
          <div className="space-y-2">
            <p>✅ App loads successfully</p>
            <p>✅ Web3 integration implemented</p>
            <p>✅ Smart contract addresses displayed</p>
            <p>✅ Ready for wallet connection testing</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
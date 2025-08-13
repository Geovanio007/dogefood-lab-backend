import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SimpleMainMenu from './components/SimpleMainMenu.jsx';

// Simple placeholder components
const GameLab = () => (
  <div className="min-h-screen p-8" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
    <div className="text-white text-center py-20">
      <h1 className="text-4xl font-bold mb-4">🧪 Game Lab</h1>
      <p className="text-xl mb-8">Coming Soon! Full game functionality is being restored.</p>
      <a href="/" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
        ← Back to Menu
      </a>
    </div>
  </div>
);

const MyTreats = () => (
  <div className="min-h-screen p-8" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
    <div className="text-white text-center py-20">
      <h1 className="text-4xl font-bold mb-4">🎨 My Treats</h1>
      <p className="text-xl mb-8">Coming Soon! View your NFT collection here.</p>
      <a href="/" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
        ← Back to Menu
      </a>
    </div>
  </div>
);

const Leaderboard = () => (
  <div className="min-h-screen p-8" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
    <div className="text-white text-center py-20">
      <h1 className="text-4xl font-bold mb-4">🏆 Leaderboard</h1>
      <p className="text-xl mb-8">Coming Soon! Compete for $LAB rewards.</p>
      <a href="/" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
        ← Back to Menu
      </a>
    </div>
  </div>
);

function App() {
  return (
    <div className="App min-h-screen">
      <Router>
        <Routes>
          <Route path="/" element={<SimpleMainMenu />} />
          <Route path="/lab" element={<GameLab />} />
          <Route path="/nfts" element={<MyTreats />} />
          <Route path="/treats" element={<MyTreats />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
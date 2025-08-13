import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SimpleMainMenu from './components/SimpleMainMenu.jsx';

// Clean placeholder components with proper Dogecoin colors
const GameLab = () => (
  <div className="min-h-screen bg-white">
    <div className="container mx-auto px-6 py-16 text-center">
      <h1 className="text-5xl font-bold mb-6" style={{ color: '#FFD700' }}>🧪 Game Lab</h1>
      <p className="text-xl mb-12" style={{ color: '#B57B2E' }}>
        Coming Soon! Full game functionality is being restored.
      </p>
      <a 
        href="/" 
        className="inline-block px-8 py-4 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        style={{ backgroundColor: '#FFD700' }}
      >
        ← Back to Menu
      </a>
    </div>
  </div>
);

const MyTreats = () => (
  <div className="min-h-screen bg-white">
    <div className="container mx-auto px-6 py-16 text-center">
      <h1 className="text-5xl font-bold mb-6" style={{ color: '#FFD700' }}>🎨 My Treats</h1>
      <p className="text-xl mb-12" style={{ color: '#B57B2E' }}>
        Coming Soon! View your NFT collection here.
      </p>
      <a 
        href="/" 
        className="inline-block px-8 py-4 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        style={{ backgroundColor: '#FFD700' }}
      >
        ← Back to Menu
      </a>
    </div>
  </div>
);

const Leaderboard = () => (
  <div className="min-h-screen bg-white">
    <div className="container mx-auto px-6 py-16 text-center">
      <h1 className="text-5xl font-bold mb-6" style={{ color: '#FFD700' }}>🏆 Leaderboard</h1>
      <p className="text-xl mb-12" style={{ color: '#B57B2E' }}>
        Coming Soon! Compete for $LAB rewards.
      </p>
      <a 
        href="/" 
        className="inline-block px-8 py-4 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        style={{ backgroundColor: '#FFD700' }}
      >
        ← Back to Menu
      </a>
    </div>
  </div>
);

function App() {
  return (
    <div className="App">
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
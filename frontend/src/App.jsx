import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext.jsx';
import { Web3Provider } from './components/Web3Provider.jsx';
import MainMenu from './components/MainMenu.jsx';
import GameLab from './components/GameLab.jsx';
import MyTreats from './components/MyTreats.jsx';
import Leaderboard from './components/Leaderboard.jsx';

function App() {
  return (
    <Web3Provider>
      <GameProvider>
        <div className="App min-h-screen">
          <Router>
            <Routes>
              <Route path="/" element={<MainMenu />} />
              <Route path="/lab" element={<GameLab />} />
              <Route path="/nfts" element={<MyTreats />} />
              <Route path="/treats" element={<MyTreats />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
            </Routes>
          </Router>
        </div>
      </GameProvider>
    </Web3Provider>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext.jsx';
import MainMenu from './components/MainMenu.jsx';
import GameLab from './components/GameLab.jsx';

function App() {
  return (
    <GameProvider>
      <div className="App min-h-screen">
        <Router>
          <Routes>
            <Route path="/" element={<MainMenu />} />
            <Route path="/lab" element={<GameLab />} />
          </Routes>
        </Router>
      </div>
    </GameProvider>
  );
}

export default App;

export default App;

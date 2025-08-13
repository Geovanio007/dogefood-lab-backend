import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext.jsx';
import MainMenu from './components/MainMenu.jsx';

function App() {
  return (
    <GameProvider>
      <div className="App min-h-screen">
        <Router>
          <Routes>
            <Route path="/" element={<MainMenu />} />
          </Routes>
        </Router>
      </div>
    </GameProvider>
  );
}

export default App;
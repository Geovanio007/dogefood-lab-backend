import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { GameProvider, useGame } from './contexts/GameContext.jsx';

// Simple GameLab component
const GameLab = () => {
  const { 
    currentLevel, 
    experience, 
    points, 
    ingredients, // Fixed: use 'ingredients' instead of 'availableIngredients'
    createTreat, 
    createdTreats,
    isNFTHolder
  } = useGame();
  
  const [selectedIngredients, setSelectedIngredients] = React.useState([]);
  const [isMixing, setIsMixing] = React.useState(false);
  const [lastCreatedTreat, setLastCreatedTreat] = React.useState(null);

  const handleIngredientClick = (ingredient) => {
    if (selectedIngredients.find(ing => ing.id === ingredient.id)) {
      setSelectedIngredients(selectedIngredients.filter(ing => ing.id !== ingredient.id));
    } else if (selectedIngredients.length < 5) {
      setSelectedIngredients([...selectedIngredients, ingredient]);
    }
  };

  const handleMixTreat = async () => {
    if (selectedIngredients.length === 0) return;
    
    setIsMixing(true);
    setTimeout(() => {
      const newTreat = createTreat(selectedIngredients);
      setLastCreatedTreat(newTreat);
      setSelectedIngredients([]);
      setIsMixing(false);
    }, 2000);
  };

  // Safety check for ingredients
  const availableIngredients = ingredients || [];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            ← Back to Menu
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">🧪 DogeFood Lab</h1>
          <p className="text-gray-300">Mix ingredients to create magical Dogetreats!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ingredients */}
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Available Ingredients ({availableIngredients.length})</h2>
            <div className="grid grid-cols-2 gap-3">
              {availableIngredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  onClick={() => handleIngredientClick(ingredient)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedIngredients.find(ing => ing.id === ingredient.id)
                      ? 'border-yellow-400 bg-yellow-400/20'
                      : 'border-white/30 bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <div className="text-2xl mb-1">{ingredient.emoji || '🟡'}</div>
                  <div className="text-sm font-medium text-white">{ingredient.name}</div>
                  <div className="text-xs text-gray-400 capitalize">{ingredient.tier || 'common'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mixing Station */}
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Mixing Station</h2>
            
            <div className={`w-40 h-40 mx-auto rounded-full bg-gradient-to-br from-gray-200 to-gray-400 border-4 border-white/40 shadow-inner flex items-center justify-center mb-6 ${
              isMixing ? 'animate-spin' : ''
            }`}>
              {selectedIngredients.length > 0 ? (
                <div className="grid grid-cols-2 gap-1">
                  {selectedIngredients.slice(0, 4).map((ingredient, index) => (
                    <div key={index} className="text-2xl">{ingredient.emoji || '🟡'}</div>
                  ))}
                </div>
              ) : (
                <div className="text-4xl text-gray-600">🥣</div>
              )}
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-2">Selected ({selectedIngredients.length}/5)</h3>
              <div className="text-sm text-gray-300">
                {selectedIngredients.length === 0 ? 'Click ingredients to add them!' : 
                 selectedIngredients.map(ing => ing.name).join(', ')}
              </div>
            </div>

            <button
              onClick={handleMixTreat}
              disabled={selectedIngredients.length === 0 || isMixing}
              className={`w-full py-3 rounded-lg font-bold text-white transition-all duration-200 ${
                selectedIngredients.length === 0 || isMixing
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 hover:scale-105 shadow-lg'
              }`}
            >
              {isMixing ? '🧪 Mixing...' : `🧪 Mix Treat (${selectedIngredients.length} ingredients)`}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{points}</div>
              <div className="text-sm text-gray-300">Points</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">Level {currentLevel}</div>
              <div className="text-sm text-gray-300">Current Level</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{createdTreats.length}</div>
              <div className="text-sm text-gray-300">Treats Created</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{availableIngredients.length}</div>
              <div className="text-sm text-gray-300">Ingredients Unlocked</div>
            </div>
          </div>
        </div>

        {lastCreatedTreat && (
          <div className="mt-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-2">🎉 New Treat Created!</h3>
            <p className="text-gray-300">{lastCreatedTreat.name} ({lastCreatedTreat.rarity})</p>
            <p className="text-green-400">+{lastCreatedTreat.experience} XP | +{lastCreatedTreat.points} Points</p>
          </div>
        )}
      </div>
    </div>
  );
};

// MainMenu component with working links
const MainMenu = () => {
  const { points, createdTreats, currentLevel } = useGame();
  
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

        {/* Player Stats */}
        <div className="mb-8 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{points}</div>
              <div className="text-sm text-gray-300">Points</div>
            </div>
            <div>
              <div className="text-2xl font-bold">Level {currentLevel}</div>
              <div className="text-sm text-gray-300">Current Level</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{createdTreats.length}</div>
              <div className="text-sm text-gray-300">Treats Created</div>
            </div>
          </div>
        </div>

        {/* Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link to="/lab" className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="text-4xl mb-4">🧪</div>
            <h3 className="text-xl font-bold mb-2">Enter Lab</h3>
            <p className="text-sm text-gray-300">Start mixing magical Dogetreats and unlock new recipes</p>
          </Link>
          
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer opacity-75">
            <div className="text-4xl mb-4">🎨</div>
            <h3 className="text-xl font-bold mb-2">My Treats</h3>
            <p className="text-sm text-gray-300">View your created Dogetreats and rare collections</p>
            <p className="text-xs text-yellow-400 mt-2">Coming Soon!</p>
          </div>
          
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 cursor-pointer opacity-75">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-bold mb-2">Leaderboard</h3>
            <p className="text-sm text-gray-300">Compete with other VIP Scientists for $LAB rewards</p>
            <p className="text-xs text-yellow-400 mt-2">Coming Soon!</p>
          </div>
        </div>

        {/* Smart Contract Info */}
        <div className="mt-6 text-xs text-gray-400">
          <p>📊 Smart Contracts Deployed on DogeOS Devnet:</p>
          <p>LAB Token: 0xc238...61d1 | DogeFood NFT: 0xC8AB...2C0 | Rewards: 0x37F2...a30</p>
        </div>
      </div>
    </div>
  );
};

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

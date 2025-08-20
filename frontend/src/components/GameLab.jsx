import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Wallet, Beaker, Timer, Trophy, Crown } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useWeb3Game } from '../hooks/useWeb3Game';
import { gameConfig } from '../config/gameConfig';
import TreatTimer from './TreatTimer';
import { useToast } from './ui/use-toast';
import { useTreatTracker } from '../hooks/useTreatTracker';
import ActiveTreats from './ActiveTreats';
import TreatNotifications from './TreatNotifications';
import DogeFoodLogo from './DogeFoodLogo';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// WebGL Detection
const isWebGLAvailable = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
};

// Wallet Connection Gate Component (separate component to avoid hooks issues)
const WalletConnectionGate = ({ onDemoModeActivate }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
    <div className="container mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <Link to="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft size={20} />
          <span className="font-bold">Back to Menu</span>
        </Link>
        <h1 className="text-4xl font-bold playful-title text-blue-800">
          🧪 DogeFood Lab
        </h1>
      </div>

      <Card className="game-card max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-xl">
            <Wallet size={48} className="text-white drop-shadow-lg" />
          </div>
          <CardTitle className="playful-title text-white text-4xl mb-4">
            🔗 Connect Your Wallet to Start Creating!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-8">
          <p className="text-white/90 playful-text text-xl leading-relaxed">
            Welcome to the DogeFood Lab! Connect your wallet to unlock the full laboratory experience.
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-gradient-to-br from-green-400/30 to-blue-500/20 rounded-2xl border-2 border-green-300/50">
              <div className="text-3xl mb-2">🧪</div>
              <h4 className="font-bold text-white text-lg mb-2 playful-title">Create Treats</h4>
              <p className="text-white/80 playful-text text-sm">Mix ingredients to create unique DogeFood treats!</p>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-br from-yellow-400/30 to-orange-500/20 rounded-2xl border-2 border-yellow-300/50">
              <div className="text-3xl mb-2">⏰</div>
              <h4 className="font-bold text-white text-lg mb-2 playful-title">Progressive Timers</h4>
              <p className="text-white/80 playful-text text-sm">Longer wait times as you level up!</p>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-br from-purple-400/30 to-pink-500/20 rounded-2xl border-2 border-purple-300/50">
              <div className="text-3xl mb-2">🏆</div>
              <h4 className="font-bold text-white text-lg mb-2 playful-title">Compete & Earn</h4>
              <p className="text-white/80 playful-text text-sm">Earn XP and compete on leaderboards!</p>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-br from-indigo-400/30 to-blue-500/20 rounded-2xl border-2 border-indigo-300/50">
              <div className="text-3xl mb-2">👑</div>
              <h4 className="font-bold text-white text-lg mb-2 playful-title">VIP Benefits</h4>
              <p className="text-white/80 playful-text text-sm">NFT holders get bonus XP!</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-blue-800 mb-2">🎮 Want to see the game in action?</h3>
            <p className="text-blue-600 text-sm mb-3">
              Try our demo mode to experience the mixing interface, progress bars, and timers!
            </p>
            <button
              onClick={onDemoModeActivate}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-bold transition-colors"
            >
              🧪 Try Demo Mode
            </button>
          </div>

          <ConnectButton />
        </CardContent>
      </Card>
    </div>
  </div>
);

// Main Game Interface Component (separate to avoid hooks issues)
const GameInterface = ({ isConnected, address, demoMode, onShowActiveTreats, treatTracker }) => {
  const {
    currentLevel,
    xpProgress,
    points,
    ingredients,
    createdTreats,
    mixing,
    isNFTHolder,
    currentDifficulty,
    startMixing,
    completeMixing,
    dispatch,
    gameConfig
  } = useGame();
  
  const web3Game = useWeb3Game();
  const { toast } = useToast();
  
  // Component-specific state
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [mixingProgress, setMixingProgress] = useState(0);
  const [mixingInterval, setMixingInterval] = useState(null);
  const [showActiveTreats, setShowActiveTreats] = useState(false);

  // Timer calculation
  const calculateTreatTimer = (level) => {
    const baseTimeHours = 1;
    const additionalTimePerLevel = 0.5;
    return Math.floor((baseTimeHours + (level - 1) * additionalTimePerLevel) * 60 * 60 * 1000);
  };

  // Enhanced treat completion with backend integration
  const handleEnhancedMixCompletion = async () => {
    if (selectedIngredients.length < 2) {
      toast({
        title: "Need More Ingredients!",
        description: "Select at least 2 ingredients to create a treat.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🧪 Starting enhanced treat creation...', {
        address: demoMode ? 'demo_user' : address,
        ingredients: selectedIngredients,
        level: currentLevel
      });
      
      if (demoMode) {
        // Demo mode - simulate treat creation
        const demoRarities = ['Common', 'Rare', 'Epic', 'Legendary'];
        const demoRarity = demoRarities[Math.floor(Math.random() * demoRarities.length)];
        
        toast({
          title: `${demoRarity} Treat Created! 🎉 (Demo)`,
          description: `Your demo ${demoRarity.toLowerCase()} treat is brewing for ${currentLevel} hours. This is demo mode!`,
          className: "bg-green-100 border-green-400"
        });

        // Demo game state update
        dispatch({ 
          type: 'COMPLETE_MIXING', 
          payload: {
            name: `Demo Level ${currentLevel} ${demoRarity} Treat`,
            rarity: demoRarity,
            flavor: selectedIngredients.join(' & '),
            image: demoRarity === 'Legendary' ? '🌟' : 
                   demoRarity === 'Epic' ? '⭐' :
                   demoRarity === 'Rare' ? '✨' : '🍪'
          }
        });
      } else {
        // Real mode - call backend API
        const response = await fetch(`${BACKEND_URL}/api/treats/enhanced`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creator_address: address,
            ingredients: selectedIngredients,
            player_level: currentLevel
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to create treat');
        }

        const result = await response.json();
        console.log('✅ Enhanced treat created:', result);

        toast({
          title: `${result.outcome.rarity} Treat Created! 🎉`,
          description: `Your ${result.outcome.rarity.toLowerCase()} treat is brewing for ${result.outcome.timer_duration_hours} hours. Come back later!`,
          className: "bg-green-100 border-green-400"
        });

        // Add treat to tracker for real-time display
        const treatData = {
          id: result.treat.id,
          name: result.treat.name,
          rarity: result.outcome.rarity,
          ingredients: result.outcome.ingredients_used,
          ready_at: new Date(result.outcome.ready_at * 1000).toISOString(),
          timer_duration: result.outcome.timer_duration_seconds,
          image: result.outcome.rarity === 'Legendary' ? '🌟' : 
                 result.outcome.rarity === 'Epic' ? '⭐' :
                 result.outcome.rarity === 'Rare' ? '✨' : '🍪'
        };
        treatTracker.addTreat(treatData);

        // Update game state
        dispatch({ 
          type: 'COMPLETE_MIXING', 
          payload: {
            name: result.treat.name,
            rarity: result.outcome.rarity,
            flavor: result.outcome.ingredients_used.join(' & '),
            image: treatData.image
          }
        });
      }

      // Reset mixing state
      dispatch({ type: 'RESET_MIXING' });
      setTimeout(() => setShowActiveTreats(true), 2000);

    } catch (error) {
      console.error('❌ Enhanced treat creation failed:', error);
      toast({
        title: "Treat Creation Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
      dispatch({ type: 'RESET_MIXING' });
    } finally {
      setSelectedIngredients([]);
    }
  };

  // Start mixing with progress animation
  const handleStartMixing = () => {
    if (selectedIngredients.length < 2) {
      toast({
        title: "Need More Ingredients!",
        description: "Please select at least 2 ingredients to start mixing.",
        variant: "destructive"
      });
      return;
    }

    if (mixingInterval) {
      clearInterval(mixingInterval);
    }

    startMixing(selectedIngredients);
    setMixingProgress(0);

    const timerDuration = calculateTreatTimer(currentLevel);
    const hours = Math.floor(timerDuration / (1000 * 60 * 60));
    const minutes = Math.floor((timerDuration % (1000 * 60 * 60)) / (1000 * 60));
    
    toast({
      title: `Mixing Started! 🧪 ${demoMode ? '(Demo)' : ''}`,
      description: `Your treat will be ready in ${hours}h ${minutes}m. Higher levels = longer wait times!`,
      className: "bg-blue-100 border-blue-400"
    });

    // Progress animation
    const interval = setInterval(() => {
      setMixingProgress(prev => {
        const newProgress = prev + 10;
        dispatch({ type: 'UPDATE_MIXING_PROGRESS', payload: newProgress });
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setMixingInterval(null);
          
          setTimeout(() => {
            handleEnhancedMixCompletion();
            setTimeout(() => setMixingProgress(0), 100);
          }, 500);
        }
        return newProgress;
      });
    }, 300);
    
    setMixingInterval(interval);
  };

  // Cleanup interval
  useEffect(() => {
    return () => {
      if (mixingInterval) {
        clearInterval(mixingInterval);
      }
    };
  }, [mixingInterval]);

  // Ingredient selection
  const handleIngredientSelect = (ingredientId) => {
    if (mixing.active) return;
    
    if (selectedIngredients.includes(ingredientId)) {
      setSelectedIngredients(prev => prev.filter(id => id !== ingredientId));
    } else if (selectedIngredients.length < 8) {
      setSelectedIngredients(prev => [...prev, ingredientId]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-6xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft size={20} />
            <span className="font-bold">Back to Menu</span>
          </Link>
          
          <div className="text-center">
            <h1 className={`text-4xl font-bold playful-title ${demoMode ? 'text-orange-600' : 'text-blue-800'}`}>
              🧪 {demoMode ? 'Demo Lab' : 'DogeFood Lab'}
            </h1>
            {demoMode && (
              <Badge className="bg-orange-500 text-white">Demo Mode Active</Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!demoMode && (
              <div className="text-right">
                <div className="font-bold text-blue-800">Level {currentLevel}</div>
                <div className="text-sm text-blue-600">{points} Points</div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Active Treats Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowActiveTreats(!showActiveTreats)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 flex items-center gap-2 shadow-lg"
          >
            {showActiveTreats ? '🧪 Back to Lab' : `📦 View My Treats ${demoMode ? '(Demo)' : `(${treatTracker.activeTreats.length + treatTracker.completedTreats.length})`}`}
          </button>
        </div>

        {/* Show Active Treats or Lab Interface */}
        {showActiveTreats ? (
          <ActiveTreats playerAddress={demoMode ? null : address} />
        ) : (
          <Card className="game-card">
            <CardHeader>
              <CardTitle className="playful-title text-white text-center text-3xl">
                🧪 Scientist's Laboratory {demoMode && '(Demo)'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              
              {/* Ingredient Shelf */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-4 playful-title">
                  🧪 Ingredient Shelf
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {ingredients.slice(0, currentLevel + 5).map((ingredient) => (
                    <button
                      key={ingredient.id}
                      onClick={() => handleIngredientSelect(ingredient.id)}
                      disabled={mixing.active}
                      className={`
                        p-4 rounded-xl border-2 transition-all duration-200 
                        ${selectedIngredients.includes(ingredient.id)
                          ? 'bg-yellow-400 border-yellow-600 shadow-lg transform scale-105'
                          : 'bg-white/90 border-gray-300 hover:border-blue-400 hover:shadow-md'
                        }
                        ${mixing.active ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <div className="text-3xl mb-2">{ingredient.emoji}</div>
                      <div className="text-sm font-bold text-gray-800">{ingredient.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Ingredients Display */}
              {selectedIngredients.length > 0 && (
                <div className="mb-6 p-4 bg-white/20 rounded-xl">
                  <h4 className="text-white font-bold mb-2">Selected Ingredients ({selectedIngredients.length}):</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIngredients.map((ingredientId, index) => {
                      const ingredient = ingredients.find(ing => ing.id === ingredientId);
                      return (
                        <span key={index} className="bg-yellow-400 px-3 py-1 rounded-full text-sm font-bold text-gray-800">
                          {ingredient?.emoji} {ingredient?.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mixing Interface */}
              <div className="text-center mb-8">
                {mixing.active ? (
                  <div className="space-y-4">
                    <div className="text-2xl font-bold text-white playful-title">
                      You're creating magic... 🧪 {demoMode && '(Demo)'}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-white/30 rounded-full h-4 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 rounded-full"
                        style={{ width: `${mixingProgress}%` }}
                      />
                    </div>
                    
                    <div className="text-white">{mixingProgress}% Complete</div>
                  </div>
                ) : (
                  <Button
                    onClick={handleStartMixing}
                    disabled={selectedIngredients.length < 2}
                    className="doge-button text-2xl px-8 py-4"
                  >
                    {selectedIngredients.length < 2 
                      ? 'Select 2+ Ingredients First'
                      : `Create with ${selectedIngredients.length} Ingredients ${demoMode ? '(Demo)' : ''}`
                    }
                  </Button>
                )}
              </div>

              {/* XP Info */}
              {!demoMode && (
                <div className="text-center text-white/80">
                  <p>Earn {gameConfig.xp.baseXpPerCombo} XP + bonus for extra ingredients!</p>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* Real-time Treat Notifications */}
        {!demoMode && <TreatNotifications playerAddress={address} />}
      </div>
    </div>
  );
};

// Main GameLab Component with proper hooks structure
const GameLab = () => {
  // 🔥 ALL HOOKS AT TOP LEVEL - NEVER CONDITIONAL
  const { isConnected, address } = useAccount();
  const { toast } = useToast();
  
  // All state hooks at top level
  const [demoMode, setDemoMode] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState(true);

  // Always call custom hooks - handle conditions inside
  const treatTracker = useTreatTracker(demoMode ? null : address);

  // All effects at top level
  useEffect(() => {
    setWebGLSupported(isWebGLAvailable());
  }, []);

  // Render logic using conditional rendering, not conditional hooks
  const shouldShowWalletGate = (!isConnected || !address) && !demoMode;
  
  return (
    <>
      {shouldShowWalletGate ? (
        <WalletConnectionGate onDemoModeActivate={() => setDemoMode(true)} />
      ) : (
        <GameInterface 
          isConnected={isConnected}
          address={address}
          demoMode={demoMode}
          treatTracker={treatTracker}
        />
      )}
    </>
  );
};

export default GameLab;
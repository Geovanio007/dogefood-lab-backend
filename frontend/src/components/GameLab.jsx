import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Wallet, Timer } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useWeb3Game } from '../hooks/useWeb3Game';
import { gameConfig } from '../config/gameConfig';
import TreatTimer from './TreatTimer';
import { useToast } from './ui/use-toast';
import { useTreatTracker } from '../hooks/useTreatTracker';
import ActiveTreats from './ActiveTreats';
import TreatNotifications from './TreatNotifications';

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

const GameLab = () => {
  // All hooks at top level - proper React hooks usage
  const { isConnected, address } = useAccount();
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
  const treatTracker = useTreatTracker(address);

  // State management
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [mixingProgress, setMixingProgress] = useState(0);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [activeTreats, setActiveTreats] = useState([]);
  const [showActiveTreats, setShowActiveTreats] = useState(false);
  const [mixingInterval, setMixingInterval] = useState(null);
  const [demoMode, setDemoMode] = useState(false);

  // Effects
  useEffect(() => {
    setWebGLSupported(isWebGLAvailable());
  }, []);

  useEffect(() => {
    return () => {
      if (mixingInterval) {
        clearInterval(mixingInterval);
      }
    };
  }, [mixingInterval]);

  // Reset mixing state when component receives a completed mixing result
  useEffect(() => {
    if (mixing.result && !mixing.active) {
      // DON'T reset mixing immediately - let timer run
      const timer = setTimeout(() => {
        // Only reset if no active treats are brewing
        if (activeTreats.length === 0) {
          dispatch({ type: 'RESET_MIXING' });
        }
      }, 30000); // Wait 30 seconds before resetting
      
      return () => clearTimeout(timer);
    }
  }, [mixing.result, mixing.active, dispatch, activeTreats.length]);

  // Timer calculation based on level (1 hour base, increases with level)
  const calculateTreatTimer = (level) => {
    const baseTimeHours = 1; // 1 hour base
    const additionalTimePerLevel = 0.5; // 30 minutes per level
    const totalHours = baseTimeHours + (level - 1) * additionalTimePerLevel;
    return Math.floor(totalHours * 60 * 60 * 1000); // Convert to milliseconds
  };

  // Show wallet connection requirement OR allow demo mode
  if (!isConnected || !address) {
    // If demo mode is active, skip wallet gate and show lab
    if (demoMode) {
      // Continue to lab interface below (don't return here)
    } else {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="container mx-auto max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <Link to="/" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors">
                <ArrowLeft size={20} />
                <span className="font-bold">Back to Menu</span>
              </Link>
              <h1 className="text-4xl font-bold playful-title text-blue-800">
                🧪 DogeFood Lab
              </h1>
            </div>

            {/* Wallet Connection Gate */}
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
                  Welcome to the DogeFood Lab! Connect your wallet to unlock the full laboratory experience and start minting NFT treats.
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 bg-gradient-to-br from-green-400/30 to-blue-500/20 rounded-2xl border-2 border-green-300/50">
                    <div className="text-3xl mb-2">🧪</div>
                    <h4 className="font-bold text-white text-lg mb-2 playful-title">Create NFT Treats</h4>
                    <p className="text-white/80 playful-text text-sm">Mix ingredients to mint unique NFT treats!</p>
                  </div>
                  
                  <div className="text-center p-4 bg-gradient-to-br from-yellow-400/30 to-orange-500/20 rounded-2xl border-2 border-yellow-300/50">
                    <div className="text-3xl mb-2">⏰</div>
                    <h4 className="font-bold text-white text-lg mb-2 playful-title">Real Timers</h4>
                    <p className="text-white/80 playful-text text-sm">Wait for treats to complete brewing!</p>
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

                <div className="space-y-4">
                  <ConnectButton />
                  
                  <div className="text-white/60 text-sm">or</div>
                  
                  <Button 
                    onClick={() => setDemoMode(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transform transition hover:scale-105"
                  >
                    🧪 Try Demo Mode (No Wallet Required)
                  </Button>
                  
                  <p className="text-white/60 text-xs">
                    Demo mode lets you explore the lab without connecting a wallet or minting NFTs
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
  }

  // Enhanced treat completion with NFT minting transaction
  const handleEnhancedMixCompletion = async () => {
    try {
      console.log('🧪 Starting enhanced treat creation with NFT minting...', {
        address,
        ingredients: selectedIngredients,
        level: currentLevel
      });

      // Step 1: Create treat in backend to get metadata
      const backendResponse = await fetch(`${BACKEND_URL}/api/treats/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_address: address,
          ingredients: selectedIngredients,
          player_level: currentLevel
        })
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json();
        throw new Error(errorData.detail || 'Failed to create treat');
      }

      const treatResult = await backendResponse.json();
      console.log('✅ Backend treat created:', treatResult);

      // Step 2: Trigger NFT minting transaction
      if (web3Game && typeof web3Game.mintTreatNFT === 'function') {
        console.log('🎨 Starting NFT minting transaction...');
        
        toast({
          title: "Confirm Transaction 🔗",
          description: "Please confirm the transaction in your wallet to mint your NFT treat!",
          className: "bg-blue-100 border-blue-400"
        });

        try {
          const mintResult = await web3Game.mintTreatNFT();

          if (mintResult && mintResult.success) {
            console.log('✅ NFT minted successfully!', mintResult);
            
            toast({
              title: `${treatResult.outcome.rarity} NFT Treat Minted! 🎉`,
              description: `Transaction confirmed! Your ${treatResult.outcome.rarity.toLowerCase()} treat NFT is brewing for ${treatResult.outcome.timer_duration_hours} hours.`,
              className: "bg-green-100 border-green-400"
            });
          }
        } catch (nftError) {
          console.warn('⚠️ NFT minting failed, but treat is still created:', nftError.message);
          toast({
            title: `${treatResult.outcome.rarity} Treat Created! ⚠️`,
            description: `NFT minting failed, but your treat is brewing for ${treatResult.outcome.timer_duration_hours} hours. You can try minting later.`,
            className: "bg-yellow-100 border-yellow-400"
          });
        }
      } else if (demoMode) {
        toast({
          title: `${treatResult.outcome.rarity} Demo Treat Created! 🧪`,
          description: `Your ${treatResult.outcome.rarity.toLowerCase()} treat is brewing for ${treatResult.outcome.timer_duration_hours} hours. (Demo mode - no NFT minted)`,
          className: "bg-purple-100 border-purple-400"
        });
      } else {
        toast({
          title: `${treatResult.outcome.rarity} Treat Created! 🎉`,
          description: `Your ${treatResult.outcome.rarity.toLowerCase()} treat is brewing for ${treatResult.outcome.timer_duration_hours} hours.`,
          className: "bg-green-100 border-green-400"
        });
      }

      // Step 3: Create active treat with timer (DO NOT RESET MIXING STATE)
      const treatData = {
        id: treatResult.treat.id,
        name: treatResult.treat.name,
        rarity: treatResult.outcome.rarity,
        ingredients: treatResult.outcome.ingredients_used,
        created_at: new Date().toISOString(),
        ready_at: new Date(Date.now() + treatResult.outcome.timer_duration_seconds * 1000).toISOString(),
        timer_duration: treatResult.outcome.timer_duration_seconds,
        brewing_status: 'brewing',
        image: treatResult.outcome.rarity === 'Legendary' ? '🌟' : 
               treatResult.outcome.rarity === 'Epic' ? '⭐' :
               treatResult.outcome.rarity === 'Rare' ? '✨' : '🍪'
      };

      // Add to active treats for persistent display
      setActiveTreats(prev => [...prev, treatData]);
      treatTracker.addTreat(treatData);

      // Update game state with treat result (KEEP MIXING STATE ACTIVE)
      dispatch({ 
        type: 'COMPLETE_MIXING', 
        payload: {
          name: treatResult.treat.name,
          rarity: treatResult.outcome.rarity,
          flavor: treatResult.outcome.ingredients_used.join(' & '),
          image: treatData.image,
          treatId: treatResult.treat.id,
          timerDuration: treatResult.outcome.timer_duration_seconds,
          readyAt: treatData.ready_at
        }
      });

      // Award XP and points
      const baseXP = gameConfig.xp.baseXpPerCombo + Math.max(0, selectedIngredients.length - 2) * gameConfig.xp.bonusXpPerExtraIngredient;
      const xpGained = Math.floor(baseXP * currentDifficulty);
      const pointsGained = Math.floor(xpGained * 0.5);
      
      dispatch({ type: 'GAIN_XP', payload: xpGained });
      dispatch({ type: 'ADD_POINTS', payload: pointsGained });

      // Clear selected ingredients but KEEP mixing state for timer display
      setSelectedIngredients([]);

    } catch (error) {
      console.error('❌ Enhanced treat creation failed:', error);
      toast({
        title: "Treat Creation Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
      
      // Reset mixing state only on error
      dispatch({ type: 'RESET_MIXING' });
    }
  };

  // Start mixing with progress animation and proper NFT flow
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

    // Start mixing in game context
    startMixing(selectedIngredients);
    setMixingProgress(0);

    const timerDuration = calculateTreatTimer(currentLevel);
    const hours = Math.floor(timerDuration / (1000 * 60 * 60));
    const minutes = Math.floor((timerDuration % (1000 * 60 * 60)) / (1000 * 60));
    
    toast({
      title: "Mixing Started! 🧪",
      description: `Creating your treat... It will be ready in ${hours}h ${minutes}m after completion!`,
      className: "bg-blue-100 border-blue-400"
    });

    // Progress animation (3 second mixing process)
    const interval = setInterval(() => {
      setMixingProgress(prev => {
        const newProgress = prev + 10;
        dispatch({ type: 'UPDATE_MIXING_PROGRESS', payload: newProgress });
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setMixingInterval(null);
          
          // Complete mixing and start NFT minting process
          setTimeout(() => {
            handleEnhancedMixCompletion();
          }, 500);
        }
        return newProgress;
      });
    }, 300); // 300ms * 10 steps = 3 seconds
    
    setMixingInterval(interval);
  };

  // Ingredient selection
  const handleIngredientSelect = (ingredientId) => {
    if (mixing.active && !mixing.result) return; // Block during active mixing, but allow after completion
    
    if (selectedIngredients.includes(ingredientId)) {
      setSelectedIngredients(prev => prev.filter(id => id !== ingredientId));
    } else if (selectedIngredients.length < 8) {
      setSelectedIngredients(prev => [...prev, ingredientId]);
    }
  };

  // Handle treat completion when timer expires
  const handleTreatComplete = (treatId) => {
    console.log('🎉 Treat completed:', treatId);
    
    // Remove from active treats
    setActiveTreats(prev => prev.filter(treat => treat.id !== treatId));
    
    // Show completion notification
    toast({
      title: "Treat Ready! 🎉",
      description: "Your treat has finished brewing and is ready to collect!",
      className: "bg-green-100 border-green-400"
    });

    // Reset mixing state if this was the last active treat
    setTimeout(() => {
      if (activeTreats.length === 1) { // Will be 0 after filter above
        dispatch({ type: 'RESET_MIXING' });
      }
    }, 1000);
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
          
          <h1 className="text-4xl font-bold playful-title text-blue-800">
            🧪 {demoMode ? 'Demo Lab' : 'DogeFood Lab'}
          </h1>

          <div className="flex items-center gap-4">
            {demoMode && (
              <Badge className="bg-purple-500 text-white px-3 py-2">
                Demo Mode Active
              </Badge>
            )}
            <div className="text-right">
              <div className="font-bold text-blue-800">Level {currentLevel}</div>
              <div className="text-sm text-blue-600">{points} Points</div>
              {isNFTHolder && (
                <Badge className="bg-yellow-500 text-white text-xs px-2 py-1">
                  VIP Scientist 👨‍🔬
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Active Treats */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowActiveTreats(!showActiveTreats)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 flex items-center gap-2 shadow-lg"
          >
            <Timer size={20} />
            {showActiveTreats ? '🧪 Back to Lab' : `📦 View Active Treats (${activeTreats.length})`}
          </button>
        </div>

        {/* Main Content */}
        {showActiveTreats ? (
          <div>
            <h2 className="text-3xl font-bold text-center text-blue-800 mb-8">🧪 Active Treats</h2>
            
            {activeTreats.length === 0 ? (
              <Card className="game-card max-w-2xl mx-auto">
                <CardContent className="text-center py-12">
                  <div className="text-6xl mb-4">🧪</div>
                  <h3 className="text-2xl font-bold text-white mb-4">No Active Treats</h3>
                  <p className="text-white/80 mb-6">Create some treats to see them brewing here!</p>
                  <Button onClick={() => setShowActiveTreats(false)} className="doge-button">
                    Start Creating Treats
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeTreats.map((treat) => (
                  <TreatTimer
                    key={treat.id}
                    treat={treat}
                    onComplete={() => handleTreatComplete(treat.id)}
                    size="large"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <Card className="game-card">
            <CardHeader>
              <CardTitle className="playful-title text-white text-center text-3xl">
                🧪 Scientist's Laboratory
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              
              {/* Original Shiba Inu Scientist */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <img
                    src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
                    alt="Shiba Inu Scientist"
                    className="w-48 h-48 object-contain drop-shadow-xl animate-bounce-slow"
                  />
                  <div className="absolute -top-4 -right-4 text-2xl animate-bounce">
                    {mixing.active ? '🧪' : '⚗️'}
                  </div>
                </div>
              </div>

              {/* Mixing Status Display */}
              {mixing.active && (
                <div className="text-center mb-8 p-6 bg-white/20 rounded-xl border-2 border-white/30">
                  <h3 className="text-2xl font-bold text-white mb-4 playful-title">
                    You're creating magic... 🧪
                  </h3>
                  
                  <div className="w-full bg-white/30 rounded-full h-6 overflow-hidden mb-4">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 rounded-full flex items-center justify-center"
                      style={{ width: `${mixingProgress}%` }}
                    >
                      <span className="text-white text-sm font-bold">{mixingProgress}%</span>
                    </div>
                  </div>
                  
                  <p className="text-white/90 text-lg">
                    Mixing {selectedIngredients.length} ingredients...
                  </p>
                </div>
              )}

              {/* Treat Result Display (Persistent Timer) */}
              {mixing.result && (
                <div className="text-center mb-8 p-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-xl border-2 border-green-400/50">
                  <div className="text-6xl mb-4">{mixing.result.image}</div>
                  <h3 className="text-2xl font-bold text-white mb-2 playful-title">
                    {mixing.result.name}
                  </h3>
                  <Badge className={`mb-4 text-lg px-4 py-2 ${
                    mixing.result.rarity === 'Legendary' ? 'bg-yellow-500' :
                    mixing.result.rarity === 'Epic' ? 'bg-purple-500' :
                    mixing.result.rarity === 'Rare' ? 'bg-blue-500' : 'bg-gray-500'
                  }`}>
                    {mixing.result.rarity}
                  </Badge>
                  
                  <p className="text-white text-lg mb-4">
                    <strong>Brewing for:</strong> Level {currentLevel} timing
                  </p>

                  {/* Persistent Timer Display */}
                  {mixing.result.readyAt && (
                    <div className="bg-white/10 rounded-lg p-4 mb-4">
                      <TreatTimer
                        treat={{
                          id: mixing.result.treatId,
                          name: mixing.result.name,
                          rarity: mixing.result.rarity,
                          ready_at: mixing.result.readyAt,
                          image: mixing.result.image
                        }}
                        onComplete={() => handleTreatComplete(mixing.result.treatId)}
                        size="normal"
                      />
                    </div>
                  )}
                  
                  <p className="text-white/80 text-sm">
                    Your treat is brewing! Come back when the timer reaches zero to collect it.
                  </p>
                </div>
              )}

              {/* Ingredient Shelf */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-4 playful-title">
                  🧪 Ingredient Shelf
                </h3>
                <p className="text-white/80 mb-4 text-center">
                  Level {currentLevel} • {ingredients.length}/25 ingredients unlocked
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {ingredients.slice(0, Math.min(currentLevel + 5, ingredients.length)).map((ingredient) => (
                    <button
                      key={ingredient.id}
                      onClick={() => handleIngredientSelect(ingredient.id)}
                      disabled={mixing.active && !mixing.result}
                      className={`
                        p-4 rounded-xl border-2 transition-all duration-200 
                        ${selectedIngredients.includes(ingredient.id)
                          ? 'bg-yellow-400 border-yellow-600 shadow-lg transform scale-105'
                          : 'bg-white/90 border-gray-300 hover:border-blue-400 hover:shadow-md'
                        }
                        ${(mixing.active && !mixing.result) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                      `}
                    >
                      <div className="text-3xl mb-2">{ingredient.emoji}</div>
                      <div className="text-sm font-bold text-gray-800">{ingredient.name}</div>
                      <div className="text-xs text-gray-600">Unlock Lv.{ingredient.unlock_level || 1}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Ingredients */}
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

              {/* Mixing Controls */}
              <div className="text-center mb-8">
                {!mixing.active ? (
                  <Button
                    onClick={handleStartMixing}
                    disabled={selectedIngredients.length < 2}
                    className="doge-button text-2xl px-8 py-4"
                  >
                    {selectedIngredients.length < 2 
                      ? 'Select 2+ Ingredients First'
                      : `Create with ${selectedIngredients.length} Ingredients${demoMode ? ' (Demo)' : ''}`
                    }
                  </Button>
                ) : mixing.result ? (
                  <Button
                    onClick={() => {
                      setSelectedIngredients([]);
                      // Allow new mixing while previous treat is brewing
                    }}
                    className="doge-button text-xl px-6 py-3"
                  >
                    Create Another Treat
                  </Button>
                ) : null}
                
                {selectedIngredients.length >= 2 && !mixing.active && (
                  <p className="text-white/80 mt-4">
                    Earn {gameConfig.xp.baseXpPerCombo + Math.max(0, selectedIngredients.length - 2) * gameConfig.xp.bonusXpPerExtraIngredient * currentDifficulty} XP + 
                    {Math.floor((gameConfig.xp.baseXpPerCombo + Math.max(0, selectedIngredients.length - 2) * gameConfig.xp.bonusXpPerExtraIngredient * currentDifficulty) * 0.5)} Points
                  </p>
                )}
              </div>

            </CardContent>
          </Card>
        )}

        {/* Real-time Treat Notifications */}
        <TreatNotifications playerAddress={address} />
      </div>
    </div>
  );
};

export default GameLab;
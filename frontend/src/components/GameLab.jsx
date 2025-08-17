import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
// import { useAccount, ConnectButton } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { useGame } from '../contexts/GameContext';
import { useWeb3Game } from '../hooks/useWeb3Game';
// import { XPProgressBar, LevelUpNotification, IngredientSack } from './game/ProgressSystem';
import { getTierInfo } from '../config/gameConfig';
// import TreatTimer from './TreatTimer';
import { ArrowLeft, Zap, Star, Sparkles, Clock, Target, Crown, ChefHat, Wallet } from 'lucide-react';
import { useToast } from './ui/use-toast';

// WebGL Detection
const isWebGLAvailable = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && 
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
};

// Fallback 2D Mixing Station Component
const FallbackMixingStation = ({ isActive, ingredients, onMix, timeRemaining }) => {
  return (
    <div className="relative w-full h-80 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl overflow-hidden border-4 border-yellow-300">
      {/* Background Lab Scene */}
      <div className="absolute inset-0">
        <img 
          src="https://images.unsplash.com/photo-1579154341184-22069e4614d2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHw0fHxsYWJvcmF0b3J5JTIwZXF1aXBtZW50JTIwY29sb3JmdWx8ZW58MHx8fHwxNzU0OTQ2OTAwfDA&ixlib=rb-4.1.0&q=85"
          alt="Mixing Station"
          className="w-full h-full object-cover opacity-20"
        />
      </div>
      
      {/* Time Limit Indicator */}
      {timeRemaining !== null && (
        <div className="absolute top-4 left-4 z-30">
          <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 ${
            timeRemaining <= 5 ? 'bg-red-500 text-white animate-pulse' : 
            timeRemaining <= 10 ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            <Clock className="w-4 h-4" />
            {timeRemaining}s
          </div>
        </div>
      )}
      
      {/* Main Character - YOU as the Creator */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="relative">
          {/* Character Image - MAXIMUM PROMINENCE */}
          <img 
            src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
            alt="You - The Ultimate DogeFood Creator"
            className={`w-60 h-60 object-contain transition-all duration-500 drop-shadow-2xl ${
              isActive ? 'animate-bounce scale-125 brightness-110' : 'hover:scale-110 hover:brightness-105'
            }`}
            style={{
              filter: 'drop-shadow(0 10px 20px rgba(255, 215, 0, 0.3))'
            }}
          />
          
          {/* Character Glow Effect */}
          <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400/20 to-orange-400/20 blur-xl transition-all duration-500 ${
            isActive ? 'scale-150 opacity-100' : 'scale-100 opacity-60'
          }`} />
          
          {/* Master Creator Badge */}
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
            <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 px-6 py-3 rounded-full shadow-2xl border-3 border-white">
              <div className="text-lg font-bold text-white text-center flex items-center gap-2">
                <span className="text-2xl">👑</span>
                <span>MASTER CREATOR</span>
                <span className="text-2xl">👑</span>
              </div>
            </div>
            {/* Badge pointer */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-yellow-400"></div>
          </div>
          
          {/* Mixing Beaker in Character's Control */}
          <div 
            onClick={onMix}
            className={`absolute -bottom-12 left-1/2 transform -translate-x-1/2 
              w-24 h-32 bg-gradient-to-b from-transparent via-yellow-300 to-yellow-600 
              border-4 border-yellow-800 rounded-full rounded-t-none cursor-pointer 
              transition-all duration-300 hover:scale-110 shadow-xl ${isActive ? 'animate-pulse scale-110' : ''}`}
            style={{
              boxShadow: '0 10px 30px rgba(255, 215, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3)'
            }}
          >
            {/* Bubbles when mixing */}
            {isActive && ingredients.length > 0 && (
              <div className="relative w-full h-full overflow-hidden">
                <div className="absolute top-3 left-3 w-3 h-3 bg-white rounded-full opacity-90 bubble-animation"></div>
                <div className="absolute top-6 right-4 w-2.5 h-2.5 bg-green-300 rounded-full opacity-80 bubble-animation" style={{animationDelay: '0.3s'}}></div>
                <div className="absolute top-9 left-5 w-2 h-2 bg-blue-300 rounded-full opacity-70 bubble-animation" style={{animationDelay: '0.6s'}}></div>
                <div className="absolute top-5 right-2 w-1.5 h-1.5 bg-pink-300 rounded-full opacity-60 bubble-animation" style={{animationDelay: '0.9s'}}></div>
              </div>
            )}
            
            {/* Mixing indicator */}
            <div className="flex items-center justify-center h-full">
              <span className="text-2xl drop-shadow-lg">🧪</span>
            </div>
          </div>
          
          {/* Dynamic Character Speech Bubble */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <div className={`bg-white/95 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-2xl border-3 transition-all duration-300 ${
              isActive ? 'border-green-400 bg-green-50/95' : 'border-yellow-400 bg-yellow-50/95'
            }`}>
              <div className="text-base font-bold text-gray-800 text-center">
                {isActive ? "🔥 CREATING LEGENDARY TREATS! 🔥" : "💪 READY TO CREATE MAGIC! 🌟"}
              </div>
            </div>
            {/* Speech bubble pointer */}
            <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent transition-colors ${
              isActive ? 'border-t-green-50/95' : 'border-t-yellow-50/95'
            }`}></div>
          </div>
        </div>
      </div>
      
      {/* Ingredient Visual Effects Around Character */}
      {ingredients.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-5">
          {ingredients.map((_, index) => (
            <div
              key={index}
              className="absolute w-8 h-8 bg-yellow-400 rounded-full opacity-60 animate-ping"
              style={{
                left: `${20 + index * 25}%`,
                top: `${30 + index * 15}%`,
                animationDelay: `${index * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}
      
      {/* Your Lab - Personal Touch */}
      <div className="absolute top-4 left-4 z-20">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 px-3 py-1 rounded-full text-white font-bold text-sm shadow-lg">
          Your Lab 🏆
        </div>
      </div>
      
      {/* Active Status Indicator */}
      <div className="absolute top-4 right-4 z-20">
        <div className={`px-3 py-1 rounded-full text-sm font-medium shadow-lg transition-all ${
          isActive 
            ? 'bg-green-400 text-white animate-pulse' 
            : 'bg-blue-400 text-white hover:bg-blue-500'
        }`}>
          {isActive ? 'Mixing... 🔥' : 'Ready! 💪'}
        </div>
      </div>
      
      {/* Click instruction - more prominent */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
        <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full text-white font-medium text-sm shadow-xl">
          Click your character to mix! 👆
        </div>
      </div>
    </div>
  );
};

// 3D Mixing Station Component (only loads if WebGL available)
const ThreeDMixingStation = ({ isActive, ingredients, onMix, timeRemaining }) => {
  const [Canvas, setCanvas] = useState(null);
  const [Three, setThree] = useState(null);
  
  useEffect(() => {
    // Dynamically import Three.js components only if WebGL is available
    if (isWebGLAvailable()) {
      import('@react-three/fiber').then(({ Canvas: CanvasComponent }) => {
        setCanvas(() => CanvasComponent);
      });
      
      import('@react-three/drei').then((drei) => {
        setThree(drei);
      });
    }
  }, []);

  const meshRef = useRef();
  
  useEffect(() => {
    if (meshRef.current && isActive) {
      const interval = setInterval(() => {
        if (meshRef.current) {
          meshRef.current.rotation.y += 0.05;
        }
      }, 50);
      
      return () => clearInterval(interval);
    }
  }, [isActive]);

  if (!Canvas || !Three) {
    return <FallbackMixingStation isActive={isActive} ingredients={ingredients} onMix={onMix} timeRemaining={timeRemaining} />;
  }

  const { OrbitControls, Sphere, Box, Cylinder } = Three;

  return (
    <div className="relative">
      {/* Time Limit Indicator for 3D */}
      {timeRemaining !== null && (
        <div className="absolute top-4 left-4 z-50">
          <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 ${
            timeRemaining <= 5 ? 'bg-red-500 text-white animate-pulse' : 
            timeRemaining <= 10 ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            <Clock className="w-4 h-4" />
            {timeRemaining}s
          </div>
        </div>
      )}
      
      <Canvas camera={{ position: [0, 2, 5] }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} />
        
        <group>
          {/* Main beaker */}
          <Cylinder
            ref={meshRef}
            args={[1, 1.5, 3, 32]}
            position={[0, 0, 0]}
            onClick={onMix}
          >
            <meshStandardMaterial
              color={isActive ? "#FFD700" : "#B57B2E"}
              transparent
              opacity={0.8}
            />
          </Cylinder>
          
          {/* Bubbles when mixing */}
          {isActive && ingredients.length > 0 && (
            <>
              <Sphere args={[0.1]} position={[-0.3, 0.5, 0]}>
                <meshStandardMaterial color="#B6E57D" />
              </Sphere>
              <Sphere args={[0.15]} position={[0.2, 0.8, 0.2]}>
                <meshStandardMaterial color="#FFD700" />
              </Sphere>
              <Sphere args={[0.1]} position={[0.4, 0.3, -0.2]}>
                <meshStandardMaterial color="#FFA500" />
              </Sphere>
            </>
          )}
          
          {/* Base */}
          <Box args={[3, 0.5, 3]} position={[0, -2, 0]}>
            <meshStandardMaterial color="#8B4513" />
          </Box>
        </group>
        
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  );
};

const GameLab = () => {
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
  
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [mixingProgress, setMixingProgress] = useState(0);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [activeTreats, setActiveTreats] = useState([]); // For timer management
  const { toast } = useToast();

  // Timer calculation based on level (1 hour base, increases with level)
  const calculateTreatTimer = (level) => {
    const baseTimeHours = 1; // 1 hour base
    const additionalTimePerLevel = 0.5; // 30 minutes per level
    return Math.floor((baseTimeHours + (level - 1) * additionalTimePerLevel) * 60 * 60 * 1000); // Convert to milliseconds
  };

  // Show wallet connection requirement if not connected
  if (!isConnected || !address) {
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
                Welcome to the DogeFood Lab! Connect your wallet to unlock the full laboratory experience.
              </p>
              
              {/* Benefits Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
                <div className="text-center p-6 bg-gradient-to-br from-green-400/30 to-emerald-500/20 rounded-3xl border-2 border-green-300/50">
                  <div className="text-4xl mb-3">🧪</div>
                  <h4 className="font-bold text-white text-xl mb-3 playful-title">Create Amazing Treats</h4>
                  <p className="text-white/80 playful-text">Mix ingredients and create unique Dogetreats with progressive timers!</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-yellow-400/30 to-orange-500/20 rounded-3xl border-2 border-yellow-300/50">
                  <div className="text-4xl mb-3">⏰</div>
                  <h4 className="font-bold text-white text-xl mb-3 playful-title">Competitive Timers</h4>
                  <p className="text-white/80 playful-text">Wait times increase with each level - only for the most patient players!</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-purple-400/30 to-pink-500/20 rounded-3xl border-2 border-purple-300/50">
                  <div className="text-4xl mb-3">🏆</div>
                  <h4 className="font-bold text-white text-xl mb-3 playful-title">Compete & Earn</h4>
                  <p className="text-white/80 playful-text">Earn XP, level up, and compete on leaderboards for $LAB rewards!</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-indigo-400/30 to-blue-500/20 rounded-3xl border-2 border-indigo-300/50">
                  <div className="text-4xl mb-3">👑</div>
                  <h4 className="font-bold text-white text-xl mb-3 playful-title">VIP Benefits</h4>
                  <p className="text-white/80 playful-text">NFT holders get bonus XP and exclusive scientist status!</p>
                </div>
              </div>

              {/* Connect Button */}
              <div className="flex justify-center">
                {/* <ConnectButton /> */}
                <Button className="doge-button text-lg px-8 py-3">
                  Connect Wallet
                </Button>
              </div>
              
              <div className="text-white/70 playful-text text-sm">
                <p>💡 <strong>New to Web3?</strong> Don't worry! We'll guide you through every step.</p>
                <p>🔒 <strong>Safe & Secure:</strong> Your wallet stays in your control at all times.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // Check WebGL support on component mount
    setWebGLSupported(isWebGLAvailable());
  }, []);

  // Reset mixing state when component receives a completed mixing result
  useEffect(() => {
    if (mixing.result && !mixing.active) {
      // Clear the mixing result after showing completion
      const timer = setTimeout(() => {
        dispatch({ type: 'RESET_MIXING' });
      }, 3000); // Clear after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [mixing.result, mixing.active, dispatch]);

  // Handle time limit countdown
  useEffect(() => {
    if (mixing.active && mixing.timeRemaining !== null) {
      setTimeRemaining(mixing.timeRemaining);
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            // Time's up - auto complete mixing with penalty
            toast({
              title: "Time's Up! ⏰",
              description: "Mixing completed with time penalty.",
              variant: "destructive"
            });
            setTimeout(() => {
              completeMixing();
              setSelectedIngredients([]);
              setMixingProgress(0);
            }, 500);
            return 0;
          }
          dispatch({ type: 'UPDATE_TIME_REMAINING', payload: prev - 1 });
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
    }
  }, [mixing.active, mixing.timeRemaining, dispatch, completeMixing, toast]);

  const handleIngredientSelect = (ingredientId) => {
    if (mixing.active) return;
    
    if (selectedIngredients.includes(ingredientId)) {
      setSelectedIngredients(selectedIngredients.filter(id => id !== ingredientId));
    } else if (selectedIngredients.length < 3) {
      setSelectedIngredients([...selectedIngredients, ingredientId]);
    } else {
      toast({
        title: "Ingredient Limit Reached!",
        description: "You can only mix 3 ingredients at a time.",
        variant: "destructive"
      });
    }
  };

  const handleStartMixing = () => {
    if (selectedIngredients.length < 2) {
      toast({
        title: "Need More Ingredients!",
        description: "Please select at least 2 ingredients to start mixing and earn XP.",
        variant: "destructive"
      });
      return;
    }

    startMixing(selectedIngredients);
    setMixingProgress(0);

    // Show timer information to user
    const timerDuration = calculateTreatTimer(currentLevel);
    const hours = Math.floor(timerDuration / (1000 * 60 * 60));
    const minutes = Math.floor((timerDuration % (1000 * 60 * 60)) / (1000 * 60));
    
    toast({
      title: "Mixing Started! 🧪",
      description: `Your treat will be ready in ${hours}h ${minutes}m. Higher levels = longer wait times!`,
      className: "bg-blue-100 border-blue-400"
    });

    // Simulate mixing progress
    const interval = setInterval(() => {
      setMixingProgress(prev => {
        const newProgress = prev + 10;
        dispatch({ type: 'UPDATE_MIXING_PROGRESS', payload: newProgress });
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            // Complete mixing and create treat with timer
            completeMixing(web3Game);
            
            // Create treat with timer
            const treatId = Date.now().toString();
            const newTreat = {
              id: treatId,
              name: `Level ${currentLevel} Special Treat`,
              ingredients: selectedIngredients,
              createdAt: Date.now(),
              completesAt: Date.now() + timerDuration,
              isReady: false,
              level: currentLevel,
              status: 'brewing'
            };
            
            // Add to active treats
            setActiveTreats(prev => [...prev, newTreat]);
            
            // Reset selected ingredients AFTER mixing completes
            setTimeout(() => {
              setSelectedIngredients([]);
              setMixingProgress(0);
              
              // Calculate XP for user feedback
              const xpGained = gameConfig.xp.baseXpPerCombo + 
                             Math.max(0, selectedIngredients.length - 2) * gameConfig.xp.bonusXpPerExtraIngredient;
              
              toast({
                title: "Treat is Brewing! ⏰",
                description: `Your Level ${currentLevel} treat is now brewing. Come back in ${hours}h ${minutes}m!`,
                className: "bg-yellow-100 border-yellow-400"
              });
            }, 100);
          }, 500);
        }
        return newProgress;
      });
    }, 300);
  };

  // Handle treat completion
  const handleTreatComplete = (treatId) => {
    setActiveTreats(prev => prev.map(treat => 
      treat.id === treatId 
        ? { ...treat, isReady: true, status: 'ready' }
        : treat
    ));
    
    toast({
      title: "Treat Ready! 🎉",
      description: "Your patient waiting has paid off! Your treat is ready to collect.",
      className: "bg-green-100 border-green-400"
    });
  };

  // Check for completed treats
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTreats(prev => prev.map(treat => {
        if (!treat.isReady && Date.now() >= treat.completesAt) {
          // Treat is ready!
          setTimeout(() => handleTreatComplete(treat.id), 100);
          return { ...treat, isReady: true, status: 'ready' };
        }
        return treat;
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getIngredientEmoji = (type) => {
    switch (type) {
      case 'legendary': return '💎';
      case 'special': return '🌟';
      case 'flavor': return '🎨';
      default: return '🥣';
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'Legendary': return 'bg-purple-500';
      case 'Epic': return 'bg-pink-500';
      case 'Rare': return 'bg-blue-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div className="lab-container min-h-screen p-6">
      {/* Level Up Notification */}
      {/* <LevelUpNotification /> */}
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <img 
              src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
              alt="Your Avatar"
              className="w-10 h-10 object-contain"
            />
            <div className="lab-level-indicator">
              Your Level {currentLevel} Lab
            </div>
          </div>
          {isNFTHolder && (
            <Badge className="vip-badge">VIP Scientist</Badge>
          )}
          
          {/* Difficulty Indicator */}
          <Badge className="bg-purple-500 text-white">
            <Target className="w-4 h-4 mr-1" />
            Difficulty: {currentDifficulty}x
          </Badge>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="glass-panel p-3">
            <div className="text-sm text-gray-600">Your Points</div>
            <div className="font-bold text-xl text-yellow-600">{points}</div>
          </div>
          <div className="glass-panel p-3">
            <div className="text-sm text-gray-600">Your Creations</div>
            <div className="font-bold text-xl text-purple-600">{createdTreats.length}</div>
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <Card className="game-card mb-6">
        <CardHeader>
          <CardTitle className="text-center playful-title text-white text-xl">
            ⭐ Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 px-4 py-2 rounded-full inline-flex items-center gap-2">
            <img 
              src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
              alt="Your Avatar"
              className="w-6 h-6 object-contain"
            />
            <span className="font-medium text-gray-800">
              Level {currentLevel} • {Math.floor(xpProgress || 0)} / {gameConfig?.xp?.xpCapPerLevel || 100} XP
            </span>
            <span className="text-lg">🌟</span>
          </div>
        </CardContent>
      </Card>

      {/* WebGL Status */}
      {!webGLSupported && (
        <Card className="glass-panel mb-8 border-2 border-orange-400">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-semibold text-orange-600">3D Mode Unavailable</div>
                <div className="text-sm text-gray-600">
                  Your browser doesn't support WebGL. Using 2D mixing station instead.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Sidebar - Ingredients */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5" />
              Ingredient Shelf
              <Badge className="text-xs bg-blue-100 text-blue-800 ml-2">
                Need 2+ for XP
              </Badge>
            </CardTitle>
            <div className="text-sm text-gray-600">
              Level {currentLevel} • {ingredients.length}/25 ingredients unlocked
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {ingredients.map((ingredient) => {
                const tierInfo = getTierInfo(ingredient.tier);
                
                return (
                  <div
                    key={ingredient.id}
                    onClick={() => handleIngredientSelect(ingredient.id)}
                    className={`
                      ingredient-slot p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${selectedIngredients.includes(ingredient.id) ? 'border-yellow-400 bg-yellow-100 scale-105' : 'border-gray-300'}
                      ${!mixing.active ? 'hover:border-yellow-400 hover:bg-yellow-50 hover:scale-102' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{ingredient.image}</span>
                      <div className="flex-1">
                        <div className="font-medium">{ingredient.name}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge className={`text-xs ${tierInfo.color} border`}>
                            Tier {ingredient.tier} • {tierInfo.name}
                          </Badge>
                          <Badge className="text-xs bg-gray-100 text-gray-600 capitalize">
                            {ingredient.rarity}
                          </Badge>
                        </div>
                        {ingredient.rarity !== 'common' && (
                          <div className="text-xs text-green-600 mt-1">
                            +{gameConfig.ingredients.rarityMultiplier[ingredient.rarity]}x XP multiplier
                          </div>
                        )}
                      </div>
                      
                      {/* Unlock level indicator */}
                      <div className="text-xs text-right">
                        <div className="text-gray-500">Unlocked</div>
                        <div className="font-bold text-green-600">Level {ingredient.unlockLevel}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium mb-2">Selected Ingredients:</div>
              <div className="flex flex-wrap gap-2 min-h-[24px]">
                {selectedIngredients.length > 0 ? (
                  selectedIngredients.map((id) => {
                    const ingredient = ingredients.find(ing => ing.id === id);
                    const tierInfo = ingredient ? getTierInfo(ingredient.tier) : null;
                    
                    return (
                      <Badge key={id} className={`text-xs ${tierInfo?.color || 'bg-gray-100 text-gray-800'} border`}>
                        {ingredient?.image} {ingredient?.name}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-xs text-gray-500">None selected</span>
                )}
              </div>
              {selectedIngredients.length >= 2 && (
                <div className="text-xs text-green-600 mt-2 font-medium flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Ready for XP! (+{gameConfig.xp.baseXpPerCombo + Math.max(0, selectedIngredients.length - 2) * gameConfig.xp.bonusXpPerExtraIngredient} base XP × {currentDifficulty}x difficulty)
                </div>
              )}
            </div>
            
            {/* Progress to next ingredient unlock */}
            {currentLevel < 25 && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                <div className="text-sm font-medium text-purple-800 mb-2">Next Unlock:</div>
                <div className="text-xs text-purple-600">
                  Level up to unlock more amazing ingredients!
                  <br />
                  <span className="font-medium">
                    {Math.max(0, gameConfig.xp.xpCapPerLevel - xpProgress)} XP to Level {currentLevel + 1}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Center - Mixing Station */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Zap className="w-5 h-5" />
              Your Mixing Station {!webGLSupported && '(2D Mode)'}
            </CardTitle>
            <div className="text-center text-sm text-gray-600">
              You are the master creator! 🎯
            </div>
          </CardHeader>
          <CardContent>
            {/* Character Avatar Header */}
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-100 to-orange-100 px-4 py-2 rounded-full border-2 border-yellow-300">
                <img 
                  src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
                  alt="Your Avatar"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-bold text-gray-800">Creator Mode Active</span>
                <span className="text-xl">🔬</span>
              </div>
            </div>
            
            <div className="mb-6">
              <Suspense fallback={
                <FallbackMixingStation
                  isActive={mixing.active}
                  ingredients={selectedIngredients}
                  onMix={handleStartMixing}
                  timeRemaining={timeRemaining}
                />
              }>
                {webGLSupported ? (
                  <div className="relative">
                    {/* Character overlay for 3D mode */}
                    <div className="absolute top-4 right-4 z-50">
                      <img 
                        src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
                        alt="You in 3D Lab"
                        className={`w-16 h-16 object-contain ${mixing.active ? 'animate-bounce' : 'hover:scale-110'} transition-all`}
                      />
                    </div>
                    <ThreeDMixingStation
                      isActive={mixing.active}
                      ingredients={selectedIngredients}
                      onMix={handleStartMixing}
                      timeRemaining={timeRemaining}
                    />
                    {/* Personal lab indicator for 3D */}
                    <div className="absolute bottom-4 left-4 bg-gradient-to-r from-yellow-400 to-orange-400 px-2 py-1 rounded text-white text-xs font-bold">
                      Your 3D Lab 🚀
                    </div>
                  </div>
                ) : (
                  <FallbackMixingStation
                    isActive={mixing.active}
                    ingredients={selectedIngredients}
                    onMix={handleStartMixing}
                    timeRemaining={timeRemaining}
                  />
                )}
              </Suspense>
            </div>
            
            {mixing.active ? (
              <div className="text-center">
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-2 text-lg font-bold text-yellow-600 mb-2">
                    <img 
                      src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
                      alt="You"
                      className="w-6 h-6 object-contain animate-spin"
                    />
                    You're creating magic... 🧪
                  </div>
                  {/* <Progress value={mixingProgress} className="h-3" /> */}
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                      style={{ width: `${mixingProgress}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Your legendary creation is coming together! ✨
                </div>
                {timeRemaining !== null && (
                  <div className={`text-sm font-bold mt-2 ${
                    timeRemaining <= 5 ? 'text-red-600' : timeRemaining <= 10 ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    Time Remaining: {timeRemaining}s
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <Button
                  onClick={handleStartMixing}
                  className="doge-button w-full text-lg py-3"
                  disabled={selectedIngredients.length < 2}
                >
                  {selectedIngredients.length < 2 ? (
                    <>
                      <img 
                        src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
                        alt="You"
                        className="w-5 h-5 object-contain mr-2"
                      />
                      Need 2+ Ingredients for XP
                    </>
                  ) : (
                    <>
                      <img 
                        src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
                        alt="You"
                        className="w-5 h-5 object-contain mr-2"
                      />
                      Create with {selectedIngredients.length} Ingredients! (+{Math.floor((gameConfig.xp.baseXpPerCombo + Math.max(0, selectedIngredients.length - 2) * gameConfig.xp.bonusXpPerExtraIngredient) * currentDifficulty)} XP)
                    </>
                  )}
                </Button>
                <div className="text-sm text-gray-500 mt-2">
                  You are the master creator - mix 2+ ingredients to earn XP! 🎨
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Sidebar - Ingredient Sack */}
        <Card className="glass-panel">
          <CardContent className="p-4">
            {/* Sack Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="text-2xl">🎒</div>
                <div>
                  <div className="font-bold text-gray-800">Ingredient Sack</div>
                  <div className="text-sm text-gray-600">
                    {mixingProgress ? Math.floor(mixingProgress / 100) : 0} / 5 mixes completed
                  </div>
                </div>
              </div>
            </div>
            
            {/* Progress Visual */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min((mixingProgress || 0) / 100 * 20, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{Math.floor((mixingProgress || 0) / 5)}% complete</span>
                <span>{Math.max(0, 5 - Math.floor((mixingProgress || 0) / 100))} more to bonus</span>
              </div>
            </div>
            
            {/* Sack Contents */}
            <div className="relative bg-gradient-to-b from-amber-100 to-amber-200 rounded-xl p-4 min-h-[120px] border-2 border-amber-300">
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">📥</div>
                <div className="text-sm">
                  Mix ingredients to fill your sack!
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Complete 5 mixes for bonus XP
                </div>
              </div>
            </div>
            
            {/* Sack Tips */}
            <div className="text-xs text-gray-500 mt-3 text-center">
              💡 Complete 5 successful mixes to unlock +50 bonus XP!
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Treats Timer Section */}
      {activeTreats.length > 0 && (
        <Card className="game-card mt-8">
          <CardHeader>
            <CardTitle className="text-center playful-title text-white text-2xl">
              ⏰ Your Brewing Treats
            </CardTitle>
            <p className="text-center text-white/80 playful-text">
              Patience is key - higher levels require longer brewing times!
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTreats.map((treat) => (
              <div key={treat.id} className="border border-gray-200 rounded-lg p-4">
                <p className="font-semibold">{treat.name}</p>
                <p className="text-sm text-gray-600">Brewing...</p>
              </div>
              /* <TreatTimer
                key={treat.id}
                treatId={treat.id}
                startTime={treat.createdAt}
                duration={treat.completesAt - treat.createdAt}
                treatName={treat.name}
                onComplete={handleTreatComplete}
                size="normal"
              /> */
            ))}
            
            {/* Timer Level Information */}
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-4 border border-blue-300/30">
              <h4 className="font-bold text-white mb-2 playful-text">⚡ Timer System:</h4>
              <div className="text-white/90 text-sm space-y-1">
                <p>🕐 <strong>Level {currentLevel}:</strong> {Math.floor(calculateTreatTimer(currentLevel) / (1000 * 60 * 60))}h {Math.floor((calculateTreatTimer(currentLevel) % (1000 * 60 * 60)) / (1000 * 60))}m brewing time</p>
                <p>📈 <strong>Next Level:</strong> {Math.floor(calculateTreatTimer(currentLevel + 1) / (1000 * 60 * 60))}h {Math.floor((calculateTreatTimer(currentLevel + 1) % (1000 * 60 * 60)) / (1000 * 60))}m brewing time</p>
                <p>🏆 <strong>Competitive:</strong> Only the most patient players reach higher levels!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips Section - Personalized */}
      <Card className="glass-panel mt-8">
        <CardHeader>
          <div className="flex items-center justify-center gap-3">
            <img 
              src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
              alt="Your Avatar"
              className="w-12 h-12 object-contain"
            />
            <h3 className="text-xl font-bold doge-gradient">Your XP & Progress Tips</h3>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-bold mb-1">Mix for XP</h4>
              <p className="text-sm text-gray-600">Use 2+ ingredients to earn {gameConfig.xp.baseXpPerCombo}+ XP per mix!</p>
            </div>
            <div>
              <div className="text-2xl mb-2">📈</div>
              <h4 className="font-bold mb-1">Level Up Fast</h4>
              <p className="text-sm text-gray-600">Each level increases difficulty by {gameConfig.difficulty.scalingFactor}x for bonus rewards!</p>
            </div>
            <div>
              <div className="text-2xl mb-2">🎒</div>
              <h4 className="font-bold mb-1">Fill Your Sack</h4>
              <p className="text-sm text-gray-600">Complete {gameConfig.sack.completionThreshold} mixes for +{gameConfig.sack.bonusXpPerCompletion} bonus XP!</p>
            </div>
          </div>
          <div className="text-center mt-6">
            <div className="bg-gradient-to-r from-yellow-100 to-orange-100 px-4 py-2 rounded-full inline-flex items-center gap-2">
              <img 
                src="https://i.ibb.co/nSyTZHR/1000025490-removebg-preview.png"
                alt="Your Avatar"
                className="w-6 h-6 object-contain"
              />
              <span className="font-medium text-gray-800">Current Progress: {Math.floor(xpProgress)} / {gameConfig.xp.xpCapPerLevel} XP to Level {currentLevel + 1}</span>
              <span className="text-lg">🌟</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameLab;
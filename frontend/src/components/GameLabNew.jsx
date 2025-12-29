import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useToast } from './ui/use-toast';
import { useTelegram } from '../contexts/TelegramContext';
import CharacterSelection from './CharacterSelection';

// Helper to get or create a guest ID
const getGuestId = () => {
  let guestId = localStorage.getItem('dogefood_guest_id');
  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('dogefood_guest_id', guestId);
  }
  return guestId;
};

const GameLabNew = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { isTelegram, telegramUser } = useTelegram();
  const { toast } = useToast();
  
  // Get user identifier - wallet address, telegram ID, or guest ID
  const getUserId = useCallback(() => {
    if (address) return address;
    if (isTelegram && telegramUser?.id) return `telegram_${telegramUser.id}`;
    return getGuestId();
  }, [address, isTelegram, telegramUser]);
  
  // Character and game state
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showCharacterSelection, setShowCharacterSelection] = useState(false);
  const [playerData, setPlayerData] = useState(null);
  const [activeTreats, setActiveTreats] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Available ingredients (level-based)
  const [availableIngredients] = useState([
    { id: 1, name: 'Chicken', emoji: '🍗', level: 1, rarity: 'common' },
    { id: 2, name: 'Rice', emoji: '🍚', level: 1, rarity: 'common' },
    { id: 3, name: 'Vegetables', emoji: '🥕', level: 1, rarity: 'common' },
    { id: 4, name: 'Salmon', emoji: '🐟', level: 3, rarity: 'uncommon' },
    { id: 5, name: 'Beef', emoji: '🥩', level: 5, rarity: 'uncommon' },
    { id: 6, name: 'Honey', emoji: '🍯', level: 7, rarity: 'rare' },
    { id: 7, name: 'Berries', emoji: '🫐', level: 4, rarity: 'uncommon' },
    { id: 8, name: 'Truffle', emoji: '🍄', level: 10, rarity: 'epic' }
  ]);

  // Load character on component mount
  useEffect(() => {
    const checkCharacterSelection = async () => {
      // Clear any existing character selection for fresh start
      localStorage.removeItem('selectedCharacter');
      
      // Always show character selection first
      setShowCharacterSelection(true);
      setSelectedCharacter(null);
    };
    
    checkCharacterSelection();
  }, []);

  // Load player data
  useEffect(() => {
    const userId = getUserId();
    if (userId) {
      loadPlayerData();
    }
  }, [address, isTelegram, telegramUser, getUserId]);

  // Timer update - refresh local time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Refresh active treats from server every 30 seconds
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      if (activeTreats.length > 0) {
        loadActiveTreats();
      }
    }, 30000);
    return () => clearInterval(refreshTimer);
  }, [activeTreats.length]);

  const loadPlayerData = async () => {
    try {
      const userId = getUserId();
      if (!userId) return;
      
      let endpoint;
      if (isTelegram && telegramUser) {
        endpoint = `${process.env.REACT_APP_BACKEND_URL}/api/player/telegram/${telegramUser.id}`;
      } else if (address) {
        endpoint = `${process.env.REACT_APP_BACKEND_URL}/api/player/${address}`;
      } else {
        // Guest user - use the guest ID
        endpoint = `${process.env.REACT_APP_BACKEND_URL}/api/player/${userId}`;
      }

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setPlayerData(data);
        loadActiveTreats();
      } else {
        // Player doesn't exist yet - set default data
        setPlayerData({ level: 1, points: 0, experience: 0 });
      }
    } catch (error) {
      console.error('Error loading player data:', error);
      setPlayerData({ level: 1, points: 0, experience: 0 });
    }
  };

  const loadActiveTreats = async () => {
    try {
      const userId = getUserId();
      if (!userId) return;

      // Use the new active treats endpoint with timer data
      const endpoint = `${process.env.REACT_APP_BACKEND_URL}/api/treats/${userId}/active`;

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        // Get treats with timer data from the new endpoint
        const treats = data.treats || [];
        // Already sorted by server, just take the treats
        setActiveTreats(treats);
      }
    } catch (error) {
      console.error('Error loading active treats:', error);
      setActiveTreats([]); // Set empty array on error
    }
  };

  const handleIngredientSelect = (ingredient) => {
    if (selectedIngredients.find(ing => ing.id === ingredient.id)) {
      setSelectedIngredients(selectedIngredients.filter(ing => ing.id !== ingredient.id));
    } else if (selectedIngredients.length < 5) {
      setSelectedIngredients([...selectedIngredients, ingredient]);
    } else {
      toast({
        title: "Maximum ingredients reached",
        description: "You can only select up to 5 ingredients per treat.",
        variant: "destructive"
      });
    }
  };

  const handleMixTreat = async () => {
    if (selectedIngredients.length < 2) {
      toast({
        title: "Need more ingredients",
        description: "Select at least 2 ingredients to create a treat.",
        variant: "destructive"
      });
      return;
    }

    const userId = getUserId();
    if (!userId) {
      toast({
        title: "Error",
        description: "Could not identify user. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/treats/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_address: userId,
          ingredients: selectedIngredients.map(ing => ing.name),
          player_level: playerData?.level || 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: `${result.outcome.rarity} Treat Created! 🎉`,
          description: `Your ${result.outcome.rarity.toLowerCase()} treat is brewing for ${result.outcome.timer_duration_hours} hours!`,
          className: "bg-green-100 border-green-400"
        });
        
        // Immediately add the new treat to active treats list
        const newTreat = {
          id: result.treat.id,
          rarity: result.outcome.rarity,
          ingredients: result.outcome.ingredients_used,
          ready_at: result.treat.ready_at,
          created_at: result.treat.created_at,
          timer_duration: result.treat.timer_duration
        };
        setActiveTreats(prev => [...prev, newTreat]);
        
        setSelectedIngredients([]);
        // Also refresh from API to ensure sync
        setTimeout(() => {
          loadActiveTreats();
          loadPlayerData();
        }, 1000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Error creating treat",
          description: errorData.detail || "Please try again later.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating treat:', error);
      toast({
        title: "Error creating treat",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeRemaining = (readyAt) => {
    if (!readyAt) return "Unknown";
    
    // Parse the date - handle both ISO format and timestamp
    const readyTime = typeof readyAt === 'number' ? readyAt : new Date(readyAt).getTime();
    const remaining = readyTime - currentTime;
    
    if (remaining <= 0) return "Ready! 🎉";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getProgressPercentage = (readyAt, timerDuration) => {
    if (!readyAt) return 0;
    
    const readyTime = typeof readyAt === 'number' ? readyAt : new Date(readyAt).getTime();
    // Use timer_duration if available, otherwise assume 1 hour
    const durationMs = (timerDuration || 3600) * 1000;
    const startTime = readyTime - durationMs;
    const elapsed = currentTime - startTime;
    const total = durationMs;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  if (showCharacterSelection) {
    return (
      <CharacterSelection 
        onCharacterSelected={(character) => {
          setSelectedCharacter(character);
          setShowCharacterSelection(false);
          console.log('Character selected:', character);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header with Character */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-6 mb-4 sm:mb-6 border border-white/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-6">
              {selectedCharacter && (
                <div className="relative">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 border-yellow-400 shadow-lg">
                    <img 
                      src={selectedCharacter.image} 
                      alt={selectedCharacter.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Character choice is permanent - no change button */}
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-4xl font-bold text-white mb-1 sm:mb-2">
                  🧪 DogeFood Laboratory
                </h1>
                {selectedCharacter && (
                  <div>
                    <p className="text-xl text-yellow-400">
                      Scientist: {selectedCharacter.name}
                    </p>
                    <p className="text-sm text-green-400">
                      Bonus: {selectedCharacter.bonus}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-right">
              {playerData && (
                <div>
                  <div className="text-white text-lg">
                    Level {playerData.level} • {playerData.points} Points
                  </div>
                  <div className="text-yellow-400">
                    {playerData.experience} XP
                  </div>
                </div>
              )}
              
              {!selectedCharacter && (
                <Button
                  onClick={() => setShowCharacterSelection(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Choose Character
                </Button>
              )}
              
              {/* Return to Menu Button */}
              <Button
                onClick={() => navigate('/')}
                className="mt-2 bg-gray-600 hover:bg-gray-700 text-white"
              >
                ← Back to Menu
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Left Panel - Ingredient Selection */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Ingredient Selection */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-2xl text-white flex items-center gap-3">
                  🧪 Select Ingredients
                  <Badge className="bg-blue-500 text-white">
                    {selectedIngredients.length}/5
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {availableIngredients
                    .filter(ing => !playerData || ing.level <= playerData.level)
                    .map((ingredient) => (
                    <div
                      key={ingredient.id}
                      data-ingredient-id={ingredient.id}
                      data-ingredient-name={ingredient.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIngredientSelect(ingredient);
                      }}
                      className={`relative p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                        selectedIngredients.find(ing => ing.id === ingredient.id)
                          ? 'bg-yellow-400 text-gray-900 scale-105 shadow-lg'
                          : 'bg-white/20 text-white hover:bg-white/30 hover:scale-105'
                      }`}
                    >
                      <div className="text-4xl mb-2 text-center pointer-events-none">
                        {ingredient.emoji}
                      </div>
                      <div className="text-center font-bold pointer-events-none">
                        {ingredient.name}
                      </div>
                      <div className="text-xs text-center mt-1 opacity-80 pointer-events-none">
                        Level {ingredient.level}
                      </div>
                      
                      {selectedIngredients.find(ing => ing.id === ingredient.id) && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center pointer-events-none">
                          ✓
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Selected Ingredients Display */}
                {selectedIngredients.length > 0 && (
                  <div className="mt-6 p-4 bg-white/20 rounded-xl">
                    <h4 className="text-white font-bold mb-3">Selected Ingredients:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedIngredients.map((ingredient) => (
                        <span
                          key={ingredient.id}
                          className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-lg font-medium"
                        >
                          {ingredient.emoji} {ingredient.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mix Button */}
            <div className="text-center">
              <Button
                onClick={handleMixTreat}
                disabled={selectedIngredients.length < 2 || isLoading}
                className="text-2xl font-bold py-6 px-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                    Mixing...
                  </>
                ) : (
                  <>
                    🧪 Mix Treat ({selectedIngredients.length} ingredients)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Panel - Active Treats */}
          <div className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-2xl text-white flex items-center gap-3">
                  ⏱️ Active Treats
                  <Badge className="bg-purple-500 text-white">
                    {activeTreats.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeTreats.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">🧪</div>
                    <p className="text-white/70">No active treats</p>
                    <p className="text-white/50 text-sm">Mix some ingredients to get started!</p>
                  </div>
                ) : (
                  activeTreats.map((treat, index) => {
                    // Use server-provided timer data, or calculate locally
                    const timerData = treat.timer || {};
                    
                    // Calculate local timer if server data not available
                    let isReady = timerData.is_ready;
                    let progress = timerData.progress_percent;
                    let timeRemaining = timerData.remaining_formatted;
                    
                    // Fallback to local calculation if timer data missing
                    if (isReady === undefined || progress === undefined) {
                      isReady = formatTimeRemaining(treat.ready_at) === "Ready! 🎉";
                      progress = getProgressPercentage(treat.ready_at, treat.timer_duration);
                      timeRemaining = formatTimeRemaining(treat.ready_at);
                    }
                    
                    return (
                      <div
                        key={treat.id || index}
                        className={`p-4 rounded-xl border-2 ${
                          isReady 
                            ? 'bg-green-100 border-green-400'
                            : 'bg-white/20 border-white/30'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className={`font-bold ${isReady ? 'text-green-800' : 'text-white'}`}>
                              {treat.rarity || 'Mystery'} Treat
                            </div>
                            <div className={`text-sm ${isReady ? 'text-green-600' : 'text-white/70'}`}>
                              {treat.ingredients?.join(', ') || 'Secret Recipe'}
                            </div>
                          </div>
                          <div className="text-2xl">
                            {isReady ? '🎉' : '⏳'}
                          </div>
                        </div>
                        
                        <Progress 
                          value={progress} 
                          className="mb-2"
                        />
                        
                        <div className={`text-center font-bold text-lg ${
                          isReady ? 'text-green-800' : 'text-yellow-400'
                        }`}>
                          {timeRemaining}
                        </div>
                        
                        {!isReady && treat.ready_at && (
                          <div className="text-center text-xs text-white/50 mt-1">
                            Ready at: {new Date(treat.ready_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLabNew;
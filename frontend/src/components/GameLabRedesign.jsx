import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import INGREDIENT_ICONS from '../config/ingredientIcons';
import { useAudio } from '../contexts/AudioContext';
import { useMusic } from '../contexts/MusicContext';
import { useNotifications } from '../contexts/NotificationContext';
import DailyLimitTracker from './DailyLimitTracker';
import PlayerStatsModal from './PlayerStatsModal';
import HappyHourBanner from './HappyHourBanner';
import SpinWheel from './SpinWheel';
import { KernelOfWowStatus, KernelBonusResult } from './KernelOfWow';
import { HelpCircle, ChevronDown, ChevronUp, BarChart3, Volume2, VolumeX, Clock, Trophy, Beaker, Bell, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to get ingredient icon
const getIcon = (ingredientId) => {
  const data = INGREDIENT_ICONS[ingredientId];
  return data?.icon || null;
};

const getIngredientName = (ingredientId, fallbackName) => {
  const data = INGREDIENT_ICONS[ingredientId];
  return data?.name || fallbackName || ingredientId;
};

const getEmoji = (ingredientId) => {
  const data = INGREDIENT_ICONS[ingredientId];
  return data?.emoji || '❓';
};

// Category styling
const CATEGORY_STYLES = {
  Core: {
    gradient: 'from-yellow-500/30 to-orange-500/30',
    border: 'border-yellow-500/60',
    glow: 'hover:shadow-yellow-500/40',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/20'
  },
  Elonverse: {
    gradient: 'from-blue-500/30 to-cyan-500/30',
    border: 'border-blue-500/60',
    glow: 'hover:shadow-cyan-500/40',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/20'
  },
  Space: {
    gradient: 'from-purple-500/30 to-indigo-500/30',
    border: 'border-purple-500/60',
    glow: 'hover:shadow-purple-500/40',
    text: 'text-purple-400',
    bg: 'bg-purple-500/20'
  },
  Lab: {
    gradient: 'from-green-500/30 to-emerald-500/30',
    border: 'border-green-500/60',
    glow: 'hover:shadow-green-500/40',
    text: 'text-green-400',
    bg: 'bg-green-500/20'
  },
  Mythic: {
    gradient: 'from-yellow-400/30 via-pink-500/30 to-purple-500/30',
    border: 'border-yellow-400/70',
    glow: 'hover:shadow-yellow-400/50',
    text: 'text-yellow-300',
    bg: 'bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-purple-500/20'
  }
};

// Rarity colors and emojis
const RARITY_STYLES = {
  Common: { color: '#9CA3AF', emoji: '⚪', bg: 'bg-gray-500/30' },
  Uncommon: { color: '#22C55E', emoji: '🟢', bg: 'bg-green-500/30' },
  Rare: { color: '#3B82F6', emoji: '🔵', bg: 'bg-blue-500/30' },
  Epic: { color: '#A855F7', emoji: '🟣', bg: 'bg-purple-500/30' },
  Legendary: { color: '#F59E0B', emoji: '🟡', bg: 'bg-yellow-500/30' },
  Mythic: { color: '#EF4444', emoji: '🔴', bg: 'bg-red-500/30' }
};

const GameLabRedesign = ({ playerAddress }) => {
  const navigate = useNavigate();
  const { playClick, playBrewing, playMix, playSuccess, playCollect, playRare, playLevelUp, startLabAmbient, stopLabAmbient, soundEnabled, toggleSound } = useAudio();
  const { stopMusic } = useMusic();
  const { scheduleTreatReadyNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Stop menu music when entering lab (lab has its own ambient sound)
  useEffect(() => {
    stopMusic();
  }, [stopMusic]);
  
  // Character selection state
  const [showCharacterSelection, setShowCharacterSelection] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectingCharacter, setSelectingCharacter] = useState(false);
  
  // Player data
  const [playerData, setPlayerData] = useState(null);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerXP, setPlayerXP] = useState(0);
  const [playerPoints, setPlayerPoints] = useState(0);
  
  // Ingredients
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Recipe validation
  const [validation, setValidation] = useState(null);
  
  // Brewing
  const [isBrewing, setIsBrewing] = useState(false);
  const [brewResult, setBrewResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  
  // Start lab ambient sound when component mounts
  useEffect(() => {
    startLabAmbient();
    return () => stopLabAmbient();
  }, [startLabAmbient, stopLabAmbient]);
  const [showBrewingAnimation, setShowBrewingAnimation] = useState(false);
  
  // Active treats
  const [activeTreats, setActiveTreats] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [collectingTreat, setCollectingTreat] = useState(null);
  const [showCollectAnimation, setShowCollectAnimation] = useState(false);
  const [collectRewards, setCollectRewards] = useState(null);
  const [collectedTreat, setCollectedTreat] = useState(null);
  const [isHappyHourActive, setIsHappyHourActive] = useState(false);
  const [happyHourBonus, setHappyHourBonus] = useState(25);
  
  // Daily limit tracking
  const [dailyStatus, setDailyStatus] = useState(null);
  const [showLimitReachedModal, setShowLimitReachedModal] = useState(false);
  
  // Tips guide and player stats
  const [showTipsGuide, setShowTipsGuide] = useState(false);
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  
  // Kernel of Wow special ingredient
  const [hasKernelOfWow, setHasKernelOfWow] = useState(false);
  const [kernelBonusResult, setKernelBonusResult] = useState(null);
  
  // Subscription expiry notification
  const [subscriptionExpiry, setSubscriptionExpiry] = useState(null);

  // Fetch happy hour status periodically
  useEffect(() => {
    const fetchHappyHour = async () => {
      try {
        const res = await fetch(`${API_URL}/api/happy-hour/status`);
        if (res.ok) {
          const data = await res.json();
          setIsHappyHourActive(data.active);
          setHappyHourBonus(data.bonus_percent || 25);
        }
      } catch (e) { /* silent */ }
    };
    fetchHappyHour();
    const iv = setInterval(fetchHappyHour, 30000);
    return () => clearInterval(iv);
  }, []);

  // Character data
  const characters = [
    {
      id: 'max',
      name: 'Shiba Scientist Max',
      description: 'The clever and curious one',
      personality: 'Methodical and analytical, Max loves to understand the science behind every reaction.',
      image: 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/5thty2tp_20250921_1510_Doge%20Scientist%20Trio_simple_compose_01k5p68s01e1p8f81hk4dvm5tm.png',
      traits: ['🧠 Analytical', '🔬 Precise', '📚 Studious'],
      bonus: '+10% Experience from treats'
    },
    {
      id: 'rex',
      name: 'Shiba Scientist Rex',
      description: 'The mischievous genius',
      personality: 'Bold and experimental, Rex loves to try wild combinations.',
      image: 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/w3y5oh69_assets_task_01k5p6sq20fh68gb4hjbs9271e_1758460753_img_0.webp',
      traits: ['⚡ Creative', '🎯 Risk-taker', '🎪 Playful'],
      bonus: '+15% Rare treat chance'
    },
    {
      id: 'luna',
      name: 'Shiba Scientist Luna',
      description: 'The smart and fearless female scientist',
      personality: 'Confident and innovative, Luna excels at optimization.',
      image: 'https://customer-assets.emergentagent.com/job_50ed16dc-caaa-4db1-ad7d-d26be77125c0/artifacts/m1k3hm3c_assets_task_01k5p7arcvf6jt34pk82yke1sh_1758461571_img_0.webp',
      traits: ['💪 Fearless', '⚡ Efficient', '🌟 Innovative'],
      bonus: '+20% Points from treats'
    }
  ];

  // Load player data
  const loadPlayerData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/player/${playerAddress}`);
      if (response.ok) {
        const data = await response.json();
        setPlayerData(data);
        setPlayerLevel(data.level || 1);
        setPlayerXP(data.experience || 0);
        setPlayerPoints(data.points || 0);
        
        // Check if player has selected a character
        if (data.selected_character) {
          const char = characters.find(c => c.id === data.selected_character);
          setSelectedCharacter(char || null);
          setShowCharacterSelection(false);
        } else {
          setShowCharacterSelection(true);
        }
      } else {
        // New player - show character selection
        setShowCharacterSelection(true);
      }
    } catch (err) {
      console.error('Error loading player:', err);
      setShowCharacterSelection(true);
    }
  }, [playerAddress]);

  // Load ingredients
  const loadIngredients = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/ingredients/unlocked/${playerLevel}`);
      if (response.ok) {
        const data = await response.json();
        
        // Flatten ingredients from categories
        const allIngredients = [];
        Object.entries(data.unlocked_by_category || {}).forEach(([category, items]) => {
          items.forEach(item => allIngredients.push({ ...item, category }));
        });
        
        setIngredients(allIngredients);
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error loading ingredients:', err);
    }
  }, [playerLevel]);

  // Load active treats
  const loadActiveTreats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/treats/${playerAddress}/active`);
      if (response.ok) {
        const data = await response.json();
        setActiveTreats(data.treats || []);
      }
    } catch (err) {
      console.error('Error loading active treats:', err);
    }
  }, [playerAddress]);

  // Handle character selection
  const handleCharacterSelect = async (character) => {
    setSelectingCharacter(true);
    try {
      const response = await fetch(`${API_URL}/api/player/${playerAddress}/select-character?character_id=${character.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedCharacter(character);
        setShowCharacterSelection(false);
        // Reload player data to get updated character info
        await loadPlayerData();
        console.log('Character selected:', data);
      } else {
        const errorData = await response.json();
        console.error('Error selecting character:', errorData);
        // If character already selected, just proceed
        if (errorData.detail?.includes('already')) {
          setShowCharacterSelection(false);
        }
      }
    } catch (err) {
      console.error('Error selecting character:', err);
    } finally {
      setSelectingCharacter(false);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Load all data in PARALLEL including subscription check
        const subFetch = fetch(`${API_URL}/api/auto-mixer/subscription/${playerAddress}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);
        
        await Promise.all([
          loadPlayerData(), 
          loadIngredients(), 
          loadActiveTreats(),
          subFetch.then(data => {
            if (data?.subscription?.expiring_soon) {
              setSubscriptionExpiry(data.subscription);
            }
          })
        ]);
      } catch (err) {
        console.error('Error during initial load:', err);
        setError('Failed to load game data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line
  }, [playerAddress]);

  // Timer update - 10s interval is sufficient for brew countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Validate recipe when ingredients change (debounced to avoid rapid API calls)
  useEffect(() => {
    if (selectedIngredients.length === 0) {
      setValidation(null);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/ingredients/validate-recipe?player_level=${playerLevel}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedIngredients)
        });
        
        if (response.ok) {
          const data = await response.json();
          setValidation(data);
        }
      } catch (err) {
        console.error('Error validating recipe:', err);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [selectedIngredients, playerLevel]);

  // Toggle ingredient selection
  const toggleIngredient = (ingredient) => {
    playClick();
    setSelectedIngredients(prev => {
      if (prev.includes(ingredient.id)) {
        return prev.filter(id => id !== ingredient.id);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 ingredients
      }
      return [...prev, ingredient.id];
    });
  };

  // Create treat
  const handleCreateTreat = async () => {
    if (selectedIngredients.length < 1) return;
    
    // Check daily limit before attempting to create
    if (dailyStatus && !dailyStatus.can_create_treat) {
      setShowLimitReachedModal(true);
      return;
    }
    
    playBrewing();
    setIsBrewing(true);
    setBrewResult(null);
    setShowBrewingAnimation(true);
    
    try {
      const response = await fetch(`${API_URL}/api/treats/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_address: playerAddress,
          ingredients: selectedIngredients,
          player_level: playerLevel
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update daily status from response
        if (data.daily_status) {
          setDailyStatus(data.daily_status);
        }
        
        // Schedule notification for when treat is ready
        if (data.treat?.ready_at) {
          const treatName = `${data.outcome?.rarity || 'Mystery'} Treat`;
          scheduleTreatReadyNotification(treatName, data.treat.ready_at);
        }
        
        // Show brewing animation for 3 seconds before showing result
        setTimeout(() => {
          setShowBrewingAnimation(false);
          setBrewResult(data);
          setShowResult(true);
          setSelectedIngredients([]);
          
          // Check for Kernel of Wow bonus
          if (data.kernel_bonus) {
            setKernelBonusResult(data.kernel_bonus);
          }
          
          // Play success sound - rare sound for rare+ treats
          const isRareOrBetter = ['Rare', 'Epic', 'Legendary', 'Mythic'].includes(data.outcome?.rarity);
          if (isRareOrBetter) {
            playRare();
          } else {
            playSuccess();
          }
        }, 3000);
        
        // Reload data in parallel for faster response
        await Promise.all([loadPlayerData(), loadActiveTreats()]);
      } else {
        setShowBrewingAnimation(false);
        
        // Check if it's a daily limit error
        if (response.status === 429) {
          const errorData = await response.json();
          if (errorData.detail?.daily_status) {
            setDailyStatus(errorData.detail.daily_status);
            setShowLimitReachedModal(true);
          } else {
            setError(errorData.detail?.message || 'Rate limited. Please wait.');
          }
        } else {
          // Try to get the error message from the response
          try {
            const errorData = await response.json();
            const errorMsg = errorData.detail?.message || errorData.detail || errorData.message || `Error ${response.status}`;
            setError(typeof errorMsg === 'string' ? errorMsg : 'Failed to create treat. Please try again.');
          } catch {
            setError(`Failed to create treat (Error ${response.status}). Please try again.`);
          }
        }
      }
    } catch (err) {
      setShowBrewingAnimation(false);
      setError(err.message || 'Network error. Please check your connection.');
      console.error('Treat creation error:', err);
    } finally {
      setIsBrewing(false);
    }
  };

  // Collect ready treat
  const handleCollectTreat = async (treat) => {
    if (collectingTreat) return;
    
    // Play collect sound, or rare sound for rare+ treats
    const isRareOrBetter = ['Rare', 'Epic', 'Legendary', 'Mythic'].includes(treat.rarity);
    if (isRareOrBetter) {
      playRare();
    } else {
      playCollect();
    }
    
    setCollectingTreat(treat.id);
    setShowCollectAnimation(true);
    setCollectedTreat(treat);
    
    // Immediately remove the treat from local state for snappy UX
    setActiveTreats(prev => prev.filter(t => t.id !== treat.id));
    
    // Safety timeout: ALWAYS close modal after 6s even if API hangs
    const safetyTimeout = setTimeout(() => {
      setShowCollectAnimation(false);
      setCollectingTreat(null);
      setCollectedTreat(null);
      setCollectRewards(null);
      loadPlayerData();
    }, 6000);
    
    try {
      const response = await fetch(`${API_URL}/api/treats/${treat.id}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_address: playerAddress })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.rewards) setCollectRewards(data.rewards);
        if (data.new_level && data.new_level > playerLevel) playLevelUp();
      }
      
      // Close 3s after API responds so user sees breakdown
      clearTimeout(safetyTimeout);
      setTimeout(() => {
        setShowCollectAnimation(false);
        setCollectingTreat(null);
        setCollectedTreat(null);
        setCollectRewards(null);
        loadPlayerData();
      }, 3000);
    } catch (err) {
      console.error('Error collecting treat:', err);
      clearTimeout(safetyTimeout);
      setTimeout(() => {
        setShowCollectAnimation(false);
        setCollectingTreat(null);
        setCollectedTreat(null);
        setCollectRewards(null);
      }, 1500);
    }
  };

  // Calculate XP progress to next level
  const xpForNextLevel = playerLevel * 100;
  const xpProgress = (playerXP % xpForNextLevel) / xpForNextLevel * 100;

  // Filter ingredients by category
  const filteredIngredients = selectedCategory === 'all' 
    ? ingredients 
    : ingredients.filter(ing => ing.category === selectedCategory);

  // Get selected ingredients data
  const selectedIngredientsData = selectedIngredients.map(id => 
    ingredients.find(ing => ing.id === id)
  ).filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f1e] via-[#0d1425] to-[#0f1830] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce text-6xl mb-4">🧪</div>
          <div className="text-white text-xl font-bold animate-pulse drop-shadow-lg">Loading Laboratory...</div>
        </div>
      </div>
    );
  }

  // Character Selection Gate
  if (showCharacterSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f1e] via-[#0d1425] to-[#0f1830] p-4 flex items-center justify-center overflow-auto">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-yellow-400/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-sky-300/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
              🧪 Choose Your Scientist! 🧪
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-2 drop-shadow-md">
              Select your character to begin your DogeFood Lab adventure
            </p>
            <p className="text-base md:text-lg text-yellow-300 font-semibold drop-shadow-md">
              ⚠️ This choice is permanent!
            </p>
          </div>

          {/* Character Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {characters.map((character) => (
              <Card
                key={character.id}
                className={`relative cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                  selectedCharacter?.id === character.id
                    ? 'ring-4 ring-yellow-400 shadow-2xl shadow-yellow-400/50 bg-gradient-to-br from-yellow-50 to-yellow-100'
                    : 'bg-white hover:bg-white shadow-xl hover:shadow-2xl'
                }`}
                onClick={() => setSelectedCharacter(character)}
              >
                <CardContent className="p-6">
                  {/* Character Image */}
                  <div className="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border-4 border-sky-400 shadow-lg">
                    <img
                      src={character.image}
                      alt={character.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = '🐕'; }}
                    />
                  </div>
                  
                  {/* Character Name */}
                  <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                    {character.name}
                  </h3>
                  <p className="text-sky-700 font-semibold text-center mb-3">
                    {character.description}
                  </p>
                  
                  {/* Personality */}
                  <p className="text-gray-700 text-sm text-center mb-4 leading-relaxed">
                    {character.personality}
                  </p>
                  
                  {/* Traits */}
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {character.traits.map((trait, index) => (
                      <span
                        key={index}
                        className="bg-sky-100 text-sky-800 px-2 py-1 rounded-full text-xs font-medium"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>

                  {/* Bonus */}
                  <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 p-3 rounded-lg border-2 border-yellow-400">
                    <p className="text-yellow-900 text-center font-bold text-sm">
                      ◉ {character.bonus}
                    </p>
                  </div>

                  {/* Selection Indicator */}
                  {selectedCharacter?.id === character.id && (
                    <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 p-2 rounded-full shadow-lg">
                      <span className="text-xl">✓</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Confirm Button */}
          <div className="text-center">
            <Button
              onClick={() => selectedCharacter && handleCharacterSelect(selectedCharacter)}
              disabled={!selectedCharacter || selectingCharacter}
              className={`text-xl font-bold py-6 px-12 rounded-xl shadow-2xl transition-all duration-300 ${
                selectedCharacter && !selectingCharacter
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white hover:scale-105 shadow-yellow-400/50'
                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
              }`}
            >
              {selectingCharacter ? (
                <span className="animate-pulse">⏳ Selecting...</span>
              ) : selectedCharacter ? (
                <>🚀 Start Adventure with {selectedCharacter.name.split(' ')[2]}!</>
              ) : (
                'Please select a character'
              )}
            </Button>
            
            {selectedCharacter && !selectingCharacter && (
              <p className="text-white/90 mt-4 text-lg drop-shadow-md">
                Ready to begin your scientific journey? Let&apos;s go! 🧪◉
              </p>
            )}
            
            {/* Back to Menu */}
            <Button
              onClick={() => navigate('/')}
              className="mt-4 bg-white/20 hover:bg-white/30 text-white border-0"
            >
              ← Back to Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1e] via-[#0d1425] to-[#0f1830] overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 p-4 max-w-7xl mx-auto">
        {/* Subscription Expiry Warning Banner */}
        {subscriptionExpiry && (
          <div 
            className="mb-4 p-3 rounded-xl border-2 bg-amber-900/40 border-amber-600 flex items-center gap-3 animate-pulse"
            data-testid="gamelab-subscription-expiry-warning"
          >
            <Bell className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 text-sm text-amber-200">
              <span className="font-semibold">Auto-Mixer expiring in {subscriptionExpiry.days_remaining} day{subscriptionExpiry.days_remaining !== 1 ? 's' : ''}!</span>
              {' '}Renew to keep earning treats automatically.
            </div>
            <button 
              onClick={() => navigate('/auto-mixer')}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-semibold rounded-lg shrink-0 transition-all"
              data-testid="gamelab-renew-btn"
            >
              Renew
            </button>
            <button 
              onClick={() => setSubscriptionExpiry(null)}
              className="text-amber-400 hover:text-amber-200 transition-colors"
              data-testid="dismiss-expiry-warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Header with Player Stats */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Player Card */}
          <Card className="flex-1 bg-[#151b28]/90 backdrop-blur-xl border-sky-500/20 overflow-hidden"
            style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {/* Show selected character image or default */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center overflow-hidden shadow-lg shadow-yellow-500/40">
                    {selectedCharacter?.image ? (
                      <img src={selectedCharacter.image} alt={selectedCharacter.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">🐕</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-sky-500 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-md">
                    Lv.{playerLevel}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-white font-bold text-lg truncate drop-shadow-md">
                    {selectedCharacter?.name?.split(' ')[2] || playerAddress?.slice(0, 8) + '...' + playerAddress?.slice(-4)}
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-yellow-300 font-semibold">XP</span>
                      <div className="flex items-center gap-2">
                        {/* Sound Toggle */}
                        <button
                          onClick={toggleSound}
                          className={`p-1 rounded-full transition-colors ${soundEnabled ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}
                          title={soundEnabled ? 'Sound ON' : 'Sound OFF'}
                          data-testid="sound-toggle-btn"
                        >
                          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => setShowPlayerStats(true)}
                          className="text-white hover:text-yellow-300 transition-colors flex items-center gap-1"
                          data-testid="your-stats-btn"
                        >
                          <BarChart3 className="w-3 h-3" />
                          <span className="underline">Your Stats</span>
                        </button>
                      </div>
                    </div>
                    {/* Custom XP Progress Bar */}
                    <div className="h-3 w-full bg-[#0d1117] rounded-full overflow-hidden border border-white/10">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(0, Math.min(100, xpProgress))}%`, boxShadow: '0 0 10px rgba(234,179,8,0.4)' }}
                      />
                    </div>
                    <div className="text-right text-[10px] text-slate-400 mt-0.5">{playerXP % xpForNextLevel}/{xpForNextLevel} to next level</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="flex gap-4">
            <Card className="bg-[#151b28]/90 backdrop-blur-xl border-yellow-500/20 min-w-[120px]"
              style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-1.5 rounded-xl bg-yellow-500/15 flex items-center justify-center"><Trophy className="w-5 h-5 text-yellow-400" /></div>
                <div className="text-2xl font-bold text-yellow-400 drop-shadow-md tabular-nums">{playerPoints}</div>
                <div className="text-xs text-slate-400">Points</div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#151b28]/90 backdrop-blur-xl border-sky-500/20 min-w-[120px]"
              style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-1.5 rounded-xl bg-sky-500/15 flex items-center justify-center"><Beaker className="w-5 h-5 text-sky-400" /></div>
                <div className="text-2xl font-bold text-sky-400 drop-shadow-md tabular-nums">{activeTreats.length}</div>
                <div className="text-xs text-slate-400">Brewing</div>
              </CardContent>
            </Card>
          </div>
          
          {/* Daily Limit Tracker */}
          <DailyLimitTracker 
            playerAddress={playerAddress} 
            onStatusUpdate={setDailyStatus}
          />
          
          {/* Error Alert */}
          {error && (
            <div className="bg-red-500/90 backdrop-blur-xl rounded-xl p-4 text-white border border-red-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <span className="font-medium">{error}</span>
                </div>
                <button 
                  onClick={() => setError(null)}
                  className="text-white/80 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Back Button */}
          <Button 
            onClick={() => navigate('/')}
            className="bg-yellow-500 hover:bg-yellow-400 text-white font-bold shadow-lg shadow-yellow-500/30 border-0"
          >
            ← Menu
          </Button>
        </div>
        
        {/* Kernel of Wow Status - Shows if player has special ingredient */}
        <KernelOfWowStatus 
          playerAddress={playerAddress}
          onStatusChange={setHasKernelOfWow}
        />

        {/* Happy Hour Banner */}
        <HappyHourBanner />

        {/* Tips & Guide Section - Collapsible */}
        <Card className="mb-6 bg-gradient-to-br from-purple-600/90 to-indigo-700/90 backdrop-blur-xl border-purple-400/50 shadow-lg">
          <CardContent className="p-0">
            <button 
              onClick={() => setShowTipsGuide(!showTipsGuide)}
              className="w-full p-4 flex items-center justify-between text-white hover:bg-white/5 transition-colors rounded-t-lg"
              data-testid="tips-guide-toggle"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-yellow-400" />
                <span className="font-bold">Lab Secrets & Tips</span>
              </div>
              {showTipsGuide ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            {showTipsGuide && (
              <div className="p-4 pt-0 border-t border-purple-400/30">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* How It Works */}
                  <div className="bg-black/20 rounded-xl p-4">
                    <h3 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                      <span>🧪</span> How Mixing Works
                    </h3>
                    <ul className="text-purple-100 text-sm space-y-1.5">
                      <li>• Combine 1-5 ingredients to create treats</li>
                      <li>• Each ingredient belongs to a category</li>
                      <li>• Different combos = different outcomes</li>
                      <li>• Experiment to discover rare recipes!</li>
                    </ul>
                  </div>
                  
                  {/* Ingredient Effects */}
                  <div className="bg-black/20 rounded-xl p-4">
                    <h3 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                      <span>◉</span> Ingredient Categories
                    </h3>
                    <ul className="text-purple-100 text-sm space-y-1.5">
                      <li>• <span className="text-amber-300">Core</span> - Basic starter ingredients (Lv 1-5)</li>
                      <li>• <span className="text-blue-300">Elonverse</span> - Tech-powered boosts (Lv 6-10)</li>
                      <li>• <span className="text-purple-300">Space</span> - Cosmic ingredients (Lv 11-15)</li>
                      <li>• <span className="text-emerald-300">Lab</span> - Experimental effects (Lv 11-15)</li>
                      <li>• <span className="text-yellow-300">Mythic</span> - Ultra-rare, Mythic treats (Lv 16+)</li>
                    </ul>
                  </div>
                  
                  {/* Rarity Tips */}
                  <div className="bg-black/20 rounded-xl p-4">
                    <h3 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                      <span>💎</span> Rarity Hints
                    </h3>
                    <ul className="text-purple-100 text-sm space-y-1.5">
                      <li>• More ingredients = higher rarity potential</li>
                      <li>• 5 ingredients unlocks Legendary/Mythic</li>
                      <li>• Starship Alloy & Mars Regolith = Legendary Gate</li>
                      <li>• Zero-G Gel + Mythic ingredient = Mythic chance!</li>
                    </ul>
                  </div>
                  
                  {/* Strategy */}
                  <div className="bg-black/20 rounded-xl p-4">
                    <h3 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                      <span>🎯</span> Pro Tips
                    </h3>
                    <ul className="text-purple-100 text-sm space-y-1.5">
                      <li>• Keep a streak for bonus treats!</li>
                      <li>• Rare treats = more points</li>
                      <li>• Complete sacks for XP bonus</li>
                      <li>• Check the leaderboard for inspiration</li>
                    </ul>
                  </div>
                </div>
                
                <p className="text-center text-purple-300 text-xs mt-4 italic">
                  The best recipes are discovered through experimentation... 🔮
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Mixing Cauldron */}
          <div className="lg:col-span-1">
            <Card className="bg-[#151b28]/90 backdrop-blur-xl border-white/[0.06] sticky top-4"
              style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 drop-shadow-md">
                  <span className="text-3xl">🔮</span> Mixing Cauldron
                </h2>

                {/* Selected Ingredients Slots */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[0, 1, 2, 3, 4].map(index => {
                    const ingredient = selectedIngredientsData[index];
                    const iconUrl = ingredient ? getIcon(ingredient.id) : null;
                    return (
                      <div
                        key={index}
                        className={`aspect-square rounded-xl border-2 border-dashed flex items-center justify-center transition-all overflow-hidden ${
                          ingredient 
                            ? `bg-gradient-to-br ${CATEGORY_STYLES[ingredient.category]?.gradient} border-solid ${CATEGORY_STYLES[ingredient.category]?.border}` 
                            : 'border-white/20 bg-white/5'
                        }`}
                        onClick={() => ingredient && toggleIngredient(ingredient)}
                      >
                        {ingredient ? (
                          <div className="text-center cursor-pointer hover:scale-110 transition-transform p-1">
                            {iconUrl ? (
                              <img 
                                src={iconUrl} 
                                alt={ingredient.name}
                                className="w-full h-full object-contain"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                              />
                            ) : null}
                            <div className={`text-2xl ${iconUrl ? 'hidden' : ''}`}>{ingredient.emoji}</div>
                          </div>
                        ) : (
                          <div className="text-white/30 text-xl">+</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Recipe Info */}
                {validation && (
                  <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/70 text-sm">Max Rarity:</span>
                      <Badge className={`${RARITY_STYLES[validation.max_possible_rarity]?.bg} text-white`}>
                        {RARITY_STYLES[validation.max_possible_rarity]?.emoji} {validation.max_possible_rarity}
                      </Badge>
                    </div>
                    
                    {validation.special_effects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {validation.special_effects.map((effect, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-yellow-400/50 text-yellow-300">
                            ◉ {effect}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {validation.has_mythic_catalyst && (
                      <div className="mt-2 text-yellow-300 text-xs flex items-center gap-1">
                        <span>🌟</span> Mythic catalyst active!
                      </div>
                    )}
                  </div>
                )}

                {/* Rarity Chances */}
                <div className="mb-4">
                  <div className="text-sky-200 text-xs mb-2 font-semibold">Possible Rarities:</div>
                  <div className="flex flex-wrap gap-1">
                    {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'].map(rarity => {
                      const canGet = validation?.possible_rarities?.includes(rarity);
                      return (
                        <Badge 
                          key={rarity}
                          className={`text-xs ${canGet ? RARITY_STYLES[rarity]?.bg : 'bg-white/10 opacity-40'} text-white`}
                        >
                          {RARITY_STYLES[rarity]?.emoji}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Create Button */}
                <Button
                  onClick={handleCreateTreat}
                  disabled={selectedIngredients.length < 1 || isBrewing}
                  className={`w-full h-14 text-lg font-bold transition-all ${
                    selectedIngredients.length >= 1 && !isBrewing
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white shadow-lg shadow-yellow-500/40'
                      : 'bg-sky-800/50 cursor-not-allowed text-white/50'
                  }`}
                >
                  {isBrewing ? (
                    <span className="animate-pulse">🔄 Brewing...</span>
                  ) : (
                    <span>🧪 Mix Treat ({selectedIngredients.length}/5)</span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Middle: Ingredient Grid */}
          <div className="lg:col-span-2">
            <Card className="bg-[#151b28]/90 backdrop-blur-xl border-white/[0.06]"
              style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <CardContent className="p-6">
                {/* Category Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <Button
                    onClick={() => setSelectedCategory('all')}
                    className={`${selectedCategory === 'all' ? 'bg-yellow-400 text-white' : 'bg-white/10 text-white'} hover:bg-yellow-400/80 border-0`}
                    size="sm"
                  >
                    All ({ingredients.length})
                  </Button>
                  {Object.keys(CATEGORY_STYLES).map(cat => {
                    const count = ingredients.filter(i => i.category === cat).length;
                    if (count === 0) return null;
                    return (
                      <Button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`${selectedCategory === cat ? CATEGORY_STYLES[cat].bg + ' border-2' : 'bg-white/10'} hover:bg-white/20 border ${CATEGORY_STYLES[cat].border}`}
                        size="sm"
                      >
                        <span className={selectedCategory === cat ? 'text-white' : CATEGORY_STYLES[cat].text}>{cat} ({count})</span>
                      </Button>
                    );
                  })}
                </div>

                {/* Ingredients Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredIngredients.map(ingredient => {
                    const isSelected = selectedIngredients.includes(ingredient.id);
                    const style = CATEGORY_STYLES[ingredient.category] || CATEGORY_STYLES.Core;
                    const iconUrl = getIcon(ingredient.id);
                    
                    return (
                      <div
                        key={ingredient.id}
                        onClick={() => toggleIngredient(ingredient)}
                        className={`
                          relative p-3 rounded-xl cursor-pointer transition-all duration-200
                          ${isSelected 
                            ? `bg-gradient-to-br ${style.gradient} border-2 ${style.border} scale-105 shadow-lg ${style.glow}` 
                            : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 hover:scale-102'
                          }
                        `}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg z-10">
                            ✓
                          </div>
                        )}
                        
                        <div className="text-center">
                          {/* Icon/Image Container */}
                          <div className="w-16 h-16 mx-auto mb-2 relative">
                            {iconUrl ? (
                              <img 
                                src={iconUrl} 
                                alt={ingredient.name}
                                className="w-full h-full object-contain transform hover:scale-110 transition-transform drop-shadow-lg"
                                onError={(e) => { 
                                  e.target.style.display = 'none'; 
                                  e.target.parentElement.querySelector('.emoji-fallback').style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`emoji-fallback text-4xl ${iconUrl ? 'hidden' : 'flex'} items-center justify-center h-full`}>
                              {ingredient.emoji}
                            </div>
                          </div>
                          
                          <div className="text-white font-medium text-sm truncate">
                            {getIngredientName(ingredient.id, ingredient.name)}
                          </div>
                          <div className={`text-xs ${style.text} mt-1`}>
                            {ingredient.category}
                          </div>
                          {ingredient.special_effect !== 'None' && (
                            <Badge variant="outline" className="mt-2 text-xs border-yellow-400/60 text-yellow-300">
                              {ingredient.special_effect}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredIngredients.length === 0 && (
                  <div className="text-center py-12 text-sky-200">
                    <div className="text-4xl mb-4">🔒</div>
                    <p className="text-white">No ingredients available in this category yet.</p>
                    <p className="text-sm mt-2 text-sky-200">Level up to unlock more!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Active Treats Section */}
        {activeTreats.length > 0 && (
          <Card className="mt-6 bg-[#151b28]/90 backdrop-blur-xl border-white/[0.06]"
            style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 drop-shadow-md">
                <span className="text-3xl animate-bounce">⏳</span> Active Brews
              </h2>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTreats.map((treat, index) => {
                  // Parse dates - ensure UTC interpretation by adding 'Z' if missing
                  const readyAtStr = treat.ready_at?.endsWith('Z') ? treat.ready_at : treat.ready_at + 'Z';
                  const createdAtStr = treat.created_at?.endsWith('Z') ? treat.created_at : treat.created_at + 'Z';
                  const readyAt = new Date(readyAtStr).getTime();
                  const createdAt = new Date(createdAtStr).getTime();
                  const total = readyAt - createdAt;
                  const elapsed = currentTime - createdAt;
                  const progress = Math.min(100, (elapsed / total) * 100);
                  const isReady = currentTime >= readyAt;
                  const remaining = Math.max(0, readyAt - currentTime);
                  
                  const hours = Math.floor(remaining / 3600000);
                  const minutes = Math.floor((remaining % 3600000) / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  
                  const rarityStyle = RARITY_STYLES[treat.rarity] || RARITY_STYLES.Common;
                  
                  return (
                    <div
                      key={treat.id || index}
                      onClick={() => isReady && handleCollectTreat(treat)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isReady 
                          ? 'bg-gradient-to-br from-yellow-400/40 to-yellow-500/40 border-yellow-400 animate-pulse cursor-pointer hover:scale-105 hover:shadow-xl hover:shadow-yellow-400/30' 
                          : `bg-white/10 border-white/30`
                      } ${collectingTreat === treat.id ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{rarityStyle.emoji}</span>
                          <div>
                            <div className="text-white font-bold drop-shadow-md">{treat.rarity} Treat</div>
                            <div className="text-sky-200 text-xs">
                              {treat.ingredients?.length || 0} ingredients
                            </div>
                          </div>
                        </div>
                        {isReady ? (
                          <Badge className="bg-yellow-400 text-white animate-bounce shadow-lg">Ready!</Badge>
                        ) : (
                          <Badge className={rarityStyle.bg + ' text-white'}>Brewing</Badge>
                        )}
                      </div>
                      
                      {/* Points display with Happy Hour bonus */}
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-sky-200 text-xs font-medium">
                          {treat.points_reward || 0} pts base
                        </span>
                        {isHappyHourActive && (
                          <span className="text-yellow-300 text-xs font-bold animate-pulse">
                            +{happyHourBonus}% Happy Hour!
                          </span>
                        )}
                      </div>
                      
                      <Progress value={progress} className="h-3 mb-2" />
                      
                      <div className="text-center">
                        {isReady ? (
                          <Button 
                            className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white font-bold shadow-lg shadow-yellow-500/40 px-6"
                            disabled={collectingTreat === treat.id}
                          >
                            {collectingTreat === treat.id ? '◉ Collecting...' : '🎁 Tap to Collect!'}
                          </Button>
                        ) : (
                          <div className="text-white font-mono text-lg drop-shadow-md">
                            {hours > 0 && `${hours}h `}{minutes}m {seconds}s
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Result Modal with Video Celebration */}
      {showResult && brewResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
          <Card className="max-w-lg w-full bg-gradient-to-b from-[#151b28] via-[#1a2035] to-[#0d1117] border-sky-500/20 overflow-hidden animate-in zoom-in-95 duration-300 my-4"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <CardContent className="p-6 text-center">
              {/* Video Celebration */}
              <div className="relative w-full aspect-video mb-4 rounded-xl overflow-hidden bg-black/30 shadow-lg">
                <video 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="w-full h-full object-cover"
                  data-testid="treat-celebration-video"
                >
                  <source src="https://customer-assets.emergentagent.com/job_dogefood-game/artifacts/kq5xkxn7_grok_video_2026-01-09-23-54-31.mp4" type="video/mp4" />
                </video>
                {/* Rarity Badge Overlay */}
                <div className="absolute top-2 right-2">
                  <Badge className={`${RARITY_STYLES[brewResult.outcome?.rarity]?.bg || 'bg-gray-500'} text-white font-bold px-3 py-1 text-sm shadow-lg`}>
                    {RARITY_STYLES[brewResult.outcome?.rarity]?.emoji} {brewResult.outcome?.rarity}
                  </Badge>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
                {brewResult.outcome?.rarity} Treat Created!
              </h2>
              
              {/* Streak Badge */}
              {brewResult.streak && (
                <div className="mb-4">
                  {brewResult.streak.streak_increased ? (
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 rounded-full animate-pulse">
                      <span className="text-2xl">🔥</span>
                      <span className="text-white font-bold">{brewResult.streak.message}</span>
                    </div>
                  ) : (
                    <div className="text-orange-300 text-sm">
                      🔥 {brewResult.streak.current_streak} day streak
                    </div>
                  )}
                </div>
              )}
              
              {/* Rewards Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-yellow-400/90 rounded-xl p-3 shadow-lg transform hover:scale-105 transition-transform">
                  <div className="text-2xl">🏆</div>
                  <div className="text-white font-bold text-xl drop-shadow-md">
                    +{brewResult.outcome?.points_reward || 0}
                  </div>
                  <div className="text-yellow-100 text-xs">Points</div>
                </div>
                <div className="bg-sky-400/90 rounded-xl p-3 shadow-lg transform hover:scale-105 transition-transform">
                  <div className="text-2xl">⭐</div>
                  <div className="text-white font-bold text-xl drop-shadow-md">
                    +{brewResult.outcome?.xp_reward || 0}
                    {brewResult.outcome?.streak_xp_bonus > 0 && (
                      <span className="text-green-300 text-sm ml-1">
                        (+{brewResult.outcome.streak_xp_bonus})
                      </span>
                    )}
                  </div>
                  <div className="text-sky-100 text-xs">
                    XP {brewResult.streak?.streak_bonus?.xp_multiplier > 1 && 
                      <span className="text-green-300">({(brewResult.streak.streak_bonus.xp_multiplier * 100).toFixed(0)}%)</span>
                    }
                  </div>
                </div>
              </div>
              
              {/* Happy Hour bonus notice */}
              {isHappyHourActive && (
                <div className="mb-4 p-2 rounded-lg bg-yellow-500/20 border border-yellow-400/30" data-testid="happy-hour-brew-notice">
                  <p className="text-yellow-300 text-xs font-semibold text-center">
                    Happy Hour Active! You'll earn +{happyHourBonus}% bonus when you collect this treat
                  </p>
                </div>
              )}
              
              {/* Brewing Time + Streak Bonus */}
              <div className="bg-white/20 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-center gap-4">
                  <div>
                    <div className="text-sky-200 text-xs mb-1">Brewing Time</div>
                    <div className="text-white font-bold text-lg drop-shadow-md">
                      ⏱️ {brewResult.outcome?.timer_duration_hours?.toFixed(1) || 0}h
                    </div>
                  </div>
                  {brewResult.streak?.streak_bonus?.brewing_reduction > 0 && (
                    <div className="text-green-300 text-sm">
                      <div className="text-xs">Streak Bonus</div>
                      <div className="font-bold">-{brewResult.streak.streak_bonus.brewing_reduction}% faster!</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sack Progress */}
              {brewResult.sack_progress && (
                <div className="bg-white/10 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-sky-200">Sack Progress</span>
                    <span className="text-white font-bold">
                      {brewResult.sack_progress.current_progress}/5
                      {brewResult.sack_progress.just_completed && (
                        <span className="ml-2 text-yellow-300 animate-pulse">🎉 +50 XP!</span>
                      )}
                    </span>
                  </div>
                  <Progress value={(brewResult.sack_progress.current_progress / 5) * 100} className="h-2 mt-2" />
                </div>
              )}
              
              {/* Kernel of Wow Bonus */}
              {brewResult.kernel_bonus && (
                <div className="mb-4">
                  <KernelBonusResult bonusInfo={brewResult.kernel_bonus} />
                </div>
              )}
              
              {/* Daily Treats Remaining */}
              {brewResult.daily_status && (
                <div className="text-sky-200 text-sm mb-4">
                  🧪 {brewResult.daily_status.remaining_treats} treats remaining today
                </div>
              )}
              
              <Button
                onClick={() => setShowResult(false)}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-white font-bold shadow-lg shadow-yellow-500/40"
                data-testid="close-result-modal-btn"
              >
                Keep Cooking! 🧪
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Brewing Animation Modal */}
      {showBrewingAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="text-center">
            {/* Cauldron Animation */}
            <div className="relative w-48 h-48 mx-auto mb-8">
              {/* Bubbles - Fixed positions to avoid re-render issues */}
              <div className="absolute inset-0">
                <div className="absolute w-4 h-4 bg-yellow-400/60 rounded-full animate-bounce" style={{ left: '25%', bottom: '35%', animationDelay: '0s', animationDuration: '0.9s' }} />
                <div className="absolute w-4 h-4 bg-yellow-400/60 rounded-full animate-bounce" style={{ left: '40%', bottom: '45%', animationDelay: '0.2s', animationDuration: '1s' }} />
                <div className="absolute w-4 h-4 bg-yellow-400/60 rounded-full animate-bounce" style={{ left: '55%', bottom: '40%', animationDelay: '0.4s', animationDuration: '0.85s' }} />
                <div className="absolute w-4 h-4 bg-yellow-400/60 rounded-full animate-bounce" style={{ left: '70%', bottom: '50%', animationDelay: '0.6s', animationDuration: '0.95s' }} />
                <div className="absolute w-4 h-4 bg-yellow-400/60 rounded-full animate-bounce" style={{ left: '30%', bottom: '55%', animationDelay: '0.8s', animationDuration: '1.1s' }} />
                <div className="absolute w-4 h-4 bg-yellow-400/60 rounded-full animate-bounce" style={{ left: '60%', bottom: '35%', animationDelay: '1s', animationDuration: '0.9s' }} />
                <div className="absolute w-4 h-4 bg-yellow-400/60 rounded-full animate-bounce" style={{ left: '45%', bottom: '60%', animationDelay: '1.2s', animationDuration: '1s' }} />
                <div className="absolute w-4 h-4 bg-yellow-400/60 rounded-full animate-bounce" style={{ left: '35%', bottom: '42%', animationDelay: '1.4s', animationDuration: '0.92s' }} />
              </div>
              
              {/* Cauldron */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-32 bg-gradient-to-b from-gray-700 to-gray-900 rounded-b-full border-4 border-gray-600 overflow-hidden">
                {/* Liquid */}
                <div className="absolute bottom-0 left-0 right-0 h-3/4 bg-gradient-to-t from-sky-500 via-emerald-400 to-yellow-400 animate-pulse">
                  {/* Waves */}
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                </div>
              </div>
              
              {/* Steam */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-2">
                <div className="w-6 h-12 bg-gradient-to-t from-white/40 to-transparent rounded-full animate-pulse blur-sm" style={{ animationDelay: '0s' }} />
                <div className="w-6 h-12 bg-gradient-to-t from-white/40 to-transparent rounded-full animate-pulse blur-sm" style={{ animationDelay: '0.3s' }} />
                <div className="w-6 h-12 bg-gradient-to-t from-white/40 to-transparent rounded-full animate-pulse blur-sm" style={{ animationDelay: '0.6s' }} />
              </div>
              
              {/* Glow */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-32 h-32 bg-sky-400/30 rounded-full blur-2xl animate-pulse" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4 animate-pulse drop-shadow-lg">
              Mixing Ingredients...
            </h2>
            <p className="text-sky-300 text-lg mb-2">Your treat is being prepared!</p>
            
            {/* Loading dots */}
            <div className="flex justify-center gap-2 mt-6">
              <div className="w-4 h-4 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-4 h-4 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-4 h-4 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Collect Animation Modal */}
      {showCollectAnimation && collectedTreat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="text-center">
            {/* Sparkle explosion effect */}
            <div className="relative w-64 h-64 mx-auto mb-8">
              {/* Central treat */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-8xl animate-bounce">
                  {RARITY_STYLES[collectedTreat.rarity]?.emoji || '🧪'}
                </div>
              </div>
              
              {/* Burst effect */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-4 h-4 bg-yellow-400 rounded-full"
                  style={{
                    left: '50%',
                    top: '50%',
                    animation: `sparkle-burst 1s ease-out ${i * 0.1}s infinite`,
                    transform: `rotate(${i * 30}deg) translateY(-80px)`,
                  }}
                />
              ))}
              
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-radial from-yellow-400/50 via-transparent to-transparent rounded-full animate-pulse" />
              
              {/* Stars floating - Fixed positions */}
              <div className="absolute text-2xl animate-ping" style={{ left: '25%', top: '30%', animationDelay: '0s', animationDuration: '1.5s' }}>⭐</div>
              <div className="absolute text-2xl animate-ping" style={{ left: '70%', top: '25%', animationDelay: '0.2s', animationDuration: '1.5s' }}>⭐</div>
              <div className="absolute text-2xl animate-ping" style={{ left: '35%', top: '65%', animationDelay: '0.4s', animationDuration: '1.5s' }}>⭐</div>
              <div className="absolute text-2xl animate-ping" style={{ left: '60%', top: '70%', animationDelay: '0.6s', animationDuration: '1.5s' }}>⭐</div>
              <div className="absolute text-2xl animate-ping" style={{ left: '45%', top: '20%', animationDelay: '0.8s', animationDuration: '1.5s' }}>⭐</div>
              <div className="absolute text-2xl animate-ping" style={{ left: '75%', top: '55%', animationDelay: '1s', animationDuration: '1.5s' }}>⭐</div>
              <div className="absolute text-2xl animate-ping" style={{ left: '20%', top: '50%', animationDelay: '1.2s', animationDuration: '1.5s' }}>⭐</div>
              <div className="absolute text-2xl animate-ping" style={{ left: '55%', top: '35%', animationDelay: '1.4s', animationDuration: '1.5s' }}>⭐</div>
            </div>
            
            <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-lg animate-pulse">
              Treat Collected!
            </h2>
            <div className="text-2xl font-bold text-yellow-400 mb-2">
              {collectedTreat.rarity} Treat
            </div>
            <p className="text-sky-300 text-lg">
              +{collectRewards?.total_points || collectRewards?.points || collectedTreat.points_reward || 0} Points • +{collectRewards?.total_xp || collectRewards?.xp || collectedTreat.xp_reward || 0} XP
            </p>
            {/* Points Breakdown */}
            {collectRewards && (collectRewards.happy_hour_bonus > 0 || collectRewards.points_bonus > 0) && (
              <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/10 text-left max-w-[280px] mx-auto" data-testid="rewards-breakdown">
                <div className="flex justify-between text-sm text-slate-300">
                  <span>Base Points</span>
                  <span className="font-bold text-white">+{collectRewards.base_points || collectedTreat.points_reward}</span>
                </div>
                {collectRewards.points_bonus > 0 && (
                  <div className="flex justify-between text-sm text-purple-300 mt-1">
                    <span>Character Bonus</span>
                    <span className="font-bold">+{collectRewards.points_bonus}</span>
                  </div>
                )}
                {collectRewards.happy_hour_bonus > 0 && (
                  <div className="flex justify-between text-sm text-yellow-300 mt-1 font-bold">
                    <span>Happy Hour +25%</span>
                    <span>+{collectRewards.happy_hour_bonus}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm mt-2 pt-2 border-t border-white/20 text-sky-300 font-black">
                  <span>Total</span>
                  <span>{collectRewards.total_points}</span>
                </div>
              </div>
            )}
            {collectRewards?.happy_hour_bonus > 0 && (
              <p className="text-yellow-300 text-base mt-2 font-semibold animate-pulse" data-testid="happy-hour-bonus-text">
                Happy Hour Bonus Applied!
              </p>
            )}
            
            {/* Tap to dismiss */}
            <button 
              onClick={() => {
                setShowCollectAnimation(false);
                setCollectingTreat(null);
                setCollectedTreat(null);
                setCollectRewards(null);
                loadPlayerData();
              }}
              className="mt-3 text-xs text-white/50 hover:text-white/80 transition-colors"
              data-testid="dismiss-collect-animation"
            >
              Tap to dismiss
            </button>
            
            {/* Confetti effect - Fixed positions */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '5%', top: '-20px', backgroundColor: '#fbbf24', animation: 'confetti-fall 2s linear 0s infinite', transform: 'rotate(45deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '15%', top: '-20px', backgroundColor: '#3b82f6', animation: 'confetti-fall 2s linear 0.1s infinite', transform: 'rotate(90deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '25%', top: '-20px', backgroundColor: '#10b981', animation: 'confetti-fall 2s linear 0.2s infinite', transform: 'rotate(135deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '35%', top: '-20px', backgroundColor: '#f472b6', animation: 'confetti-fall 2s linear 0.3s infinite', transform: 'rotate(180deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '45%', top: '-20px', backgroundColor: '#8b5cf6', animation: 'confetti-fall 2s linear 0.4s infinite', transform: 'rotate(225deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '55%', top: '-20px', backgroundColor: '#fbbf24', animation: 'confetti-fall 2s linear 0.5s infinite', transform: 'rotate(270deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '65%', top: '-20px', backgroundColor: '#3b82f6', animation: 'confetti-fall 2s linear 0.6s infinite', transform: 'rotate(315deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '75%', top: '-20px', backgroundColor: '#10b981', animation: 'confetti-fall 2s linear 0.7s infinite', transform: 'rotate(360deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '85%', top: '-20px', backgroundColor: '#f472b6', animation: 'confetti-fall 2s linear 0.8s infinite', transform: 'rotate(45deg)' }} />
              <div className="absolute w-3 h-3 rounded-sm" style={{ left: '95%', top: '-20px', backgroundColor: '#8b5cf6', animation: 'confetti-fall 2s linear 0.9s infinite', transform: 'rotate(90deg)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Daily Limit Reached Modal */}
      {showLimitReachedModal && dailyStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="max-w-md w-full bg-gradient-to-b from-red-500 via-red-600 to-red-700 border-red-400 overflow-hidden shadow-2xl" data-testid="limit-reached-modal">
            <CardContent className="p-6 text-center">
              {/* Icon */}
              <div className="text-6xl mb-4">🚫</div>
              
              <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                Daily Limit Reached!
              </h2>
              
              <p className="text-red-200 mb-6">
                You've created {dailyStatus.treats_created_today || dailyStatus.treats_today || 0} / {dailyStatus.total_limit || dailyStatus.daily_limit || 16} treats today.
              </p>
              
              {/* Info Box */}
              <div className="bg-white/10 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm">Base limit:</span>
                  <span className="text-white font-bold">{dailyStatus.base_limit || 4} treats per window</span>
                </div>
                {dailyStatus.extra_treats_balance > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm">Bonus treats:</span>
                    <span className="text-green-400 font-bold">+{dailyStatus.extra_treats_balance}</span>
                  </div>
                )}
                {dailyStatus.time_until_reset_seconds > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Resets in:</span>
                    <span className="text-yellow-300 font-bold">
                      {Math.floor(dailyStatus.time_until_reset_seconds / 3600)}h {Math.floor((dailyStatus.time_until_reset_seconds % 3600) / 60)}m
                    </span>
                  </div>
                )}
              </div>
              
              {/* Extra Life Option - Updated for DOGE payments */}
              <div className="bg-rose-400/20 border border-rose-400/50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">❤️</span>
                  <div className="text-left">
                    <h3 className="text-rose-300 font-bold">Want More Treats?</h3>
                    <p className="text-rose-200 text-sm">
                      Purchase Extra Life packs with DOGE to get more treats!
                    </p>
                  </div>
                </div>
                
                {/* Package Options Preview */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-yellow-400 font-bold">10 DOGE</div>
                    <div className="text-white">+2 treats</div>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-yellow-400 font-bold">20 DOGE</div>
                    <div className="text-white">+4 treats</div>
                  </div>
                  <div className="bg-white/10 rounded p-2 border border-yellow-500/50">
                    <div className="text-yellow-400 font-bold">35 DOGE</div>
                    <div className="text-white">+6 treats</div>
                  </div>
                </div>
              </div>
              
              {/* Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowLimitReachedModal(false)}
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white"
                  data-testid="close-limit-modal-btn"
                >
                  OK, Got It
                </Button>
                <Button
                  onClick={() => {
                    setShowLimitReachedModal(false);
                    // Trigger the Extra Life modal in DailyLimitTracker
                    // This is handled by the DailyLimitTracker component's "Extra Life" button
                    const extraLifeBtn = document.querySelector('[data-testid="buy-extra-life-btn"]');
                    if (extraLifeBtn) extraLifeBtn.click();
                  }}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white font-bold"
                  data-testid="buy-extra-life-from-modal-btn"
                >
                  <span className="mr-2">❤️</span>
                  Buy Extra Life
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Player Stats Modal */}
      {showPlayerStats && (
        <PlayerStatsModal 
          playerAddress={playerAddress}
          onClose={() => setShowPlayerStats(false)}
        />
      )}

      {/* Spin the Wheel */}
      <SpinWheel
        playerAddress={playerAddress}
        onPrizeWon={(data) => {
          // Refresh player data after winning
          loadPlayerData();
          loadActiveTreats();
        }}
      />
    </div>
  );
};

export default GameLabRedesign;

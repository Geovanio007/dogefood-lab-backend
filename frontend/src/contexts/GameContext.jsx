import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import axios from 'axios';
import { 
  gameConfig, 
  getRandomLevel1Ingredients, 
  mainIngredientsDatabase,
  createTreatName,
  calculateTreatXP,
  formatTimeRemaining,
  isTimerComplete
} from '../config/gameConfig';

const GameContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const initialState = {
  // Enhanced User & Profile
  player: null,
  walletAddress: null,
  nickname: null,
  isRegistered: false,
  isNFTHolder: false,
  
  // Enhanced Game State
  currentLevel: 1,
  experience: 0,
  points: 0,
  
  // Enhanced Ingredient System
  availableIngredients: getRandomLevel1Ingredients(6), // Level 1 ingredients
  mainIngredients: mainIngredientsDatabase,
  selectedIngredients: [],
  selectedMainIngredient: null,
  
  // Enhanced Treat System
  createdTreats: [],
  brewingTreats: [], // Treats currently brewing with timers
  readyTreats: [], // Treats ready to collect
  totalTreatsCreated: 0,
  
  // Timer System
  activeTimers: [], // Array of active treat timers
  
  // UI State
  showRegistration: false,
  isLoading: false,
  mixingInProgress: false,
  
  // Leaderboard
  leaderboard: [],
  
  // Notifications
  notifications: []
};
};

// Enhanced Game Reducer
function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_PLAYER':
      return { 
        ...state, 
        player: action.payload,
        walletAddress: action.payload?.address,
        nickname: action.payload?.nickname,
        isRegistered: true,
        isNFTHolder: action.payload?.is_nft_holder || false,
        currentLevel: action.payload?.level || 1,
        experience: action.payload?.experience || 0,
        points: action.payload?.points || 0
      };
    
    case 'SET_WALLET_ADDRESS':
      return { ...state, walletAddress: action.payload };
    
    case 'SET_REGISTRATION_STATUS':
      return { ...state, isRegistered: action.payload };
    
    case 'SHOW_REGISTRATION':
      return { ...state, showRegistration: action.payload };
    
    case 'SELECT_INGREDIENT':
      const ingredient = action.payload;
      const isAlreadySelected = state.selectedIngredients.some(ing => ing.id === ingredient.id);
      
      if (isAlreadySelected) {
        return {
          ...state,
          selectedIngredients: state.selectedIngredients.filter(ing => ing.id !== ingredient.id)
        };
      } else if (state.selectedIngredients.length < 3) { // Max 3 ingredients
        return {
          ...state,
          selectedIngredients: [...state.selectedIngredients, ingredient]
        };
      }
      return state;
    
    case 'SELECT_MAIN_INGREDIENT':
      return { ...state, selectedMainIngredient: action.payload };
    
    case 'CLEAR_SELECTION':
      return { 
        ...state, 
        selectedIngredients: [], 
        selectedMainIngredient: null 
      };
    
    case 'SET_MIXING_PROGRESS':
      return { ...state, mixingInProgress: action.payload };
    
    case 'ADD_TREAT':
      const newTreat = action.payload;
      return {
        ...state,
        createdTreats: [...state.createdTreats, newTreat],
        totalTreatsCreated: state.totalTreatsCreated + 1,
        brewingTreats: newTreat.brewing_status === 'brewing' 
          ? [...state.brewingTreats, newTreat] 
          : state.brewingTreats
      };
    
    case 'UPDATE_BREWING_TREATS':
      return { ...state, brewingTreats: action.payload };
    
    case 'UPDATE_READY_TREATS':
      return { ...state, readyTreats: action.payload };
    
    case 'ADD_TIMER':
      return { 
        ...state, 
        activeTimers: [...state.activeTimers, action.payload] 
      };
    
    case 'REMOVE_TIMER':
      return {
        ...state,
        activeTimers: state.activeTimers.filter(timer => timer.treatId !== action.payload)
      };
    
    case 'SET_TREATS':
      return { ...state, createdTreats: action.payload };
    
    case 'SET_LEADERBOARD':
      return { ...state, leaderboard: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, {
          id: Date.now(),
          ...action.payload
        }]
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(notif => notif.id !== action.payload)
      };
    
    case 'SHUFFLE_INGREDIENTS':
      // Refresh the available ingredients to keep gameplay fresh
      return {
        ...state,
        availableIngredients: getRandomLevel1Ingredients(6)
      };
    
    case 'GAIN_XP':
      const xpGained = action.payload;
      const newTotalXp = state.experience + xpGained;
      const xpCapPerLevel = gameConfig.xp.xpCapPerLevel;
      
      // Check for level up
      if (newTotalXp >= xpCapPerLevel) {
        const newLevel = state.currentLevel + 1;
        return {
          ...state,
          experience: newTotalXp,
          currentLevel: newLevel
        };
      }
      
      return {
        ...state,
        experience: newTotalXp
      };
    
    case 'ADD_POINTS':
      return { 
        ...state, 
        points: state.isNFTHolder ? state.points + action.payload : state.points 
      };
    
    default:
      return state;
  }
}
        id: Date.now().toString(),
        ingredients: action.payload.ingredients,
        treatName: action.payload.treatName,
        rarity: action.payload.rarity,
        timestamp: Date.now()
      };
      
      const maxSackSize = gameConfig.sack.maxVisibleIngredients;
      const updatedSack = [...state.ingredientSack, newSackItem].slice(-maxSackSize);
      const newMixesThisLevel = state.mixesThisLevel + 1;
      
      return {
        ...state,
        ingredientSack: updatedSack,
        mixesThisLevel: newMixesThisLevel
      };
    
    case 'COMPLETE_RECIPE':
      // Award bonus XP for recipe completion
      const recipeBonus = gameConfig.sack.bonusXpPerCompletion;
      
      return {
        ...state,
        ingredientSack: [], // Clear sack after recipe completion
        mixesThisLevel: 0   // Reset mixes counter
      };
    
    case 'START_MIXING':
      return {
        ...state,
        mixing: {
          active: true,
          selectedIngredients: action.payload.ingredients,
          progress: 0,
          result: null,
          timeLimit: action.payload.timeLimit,
          timeRemaining: action.payload.timeLimit
        }
      };
    
    case 'UPDATE_MIXING_PROGRESS':
      return {
        ...state,
        mixing: { ...state.mixing, progress: action.payload }
      };
    
    case 'UPDATE_TIME_REMAINING':
      return {
        ...state,
        mixing: { ...state.mixing, timeRemaining: action.payload }
      };
    
    case 'COMPLETE_MIXING':
      const treatId = Date.now().toString();
      const newTreat = {
        id: treatId,
        name: action.payload.name,
        ingredients: state.mixing.selectedIngredients,
        rarity: action.payload.rarity,
        flavor: action.payload.flavor,
        createdAt: new Date().toISOString(),
        image: action.payload.image,
        level: state.currentLevel
      };
      
      return {
        ...state,
        createdTreats: [...state.createdTreats, newTreat],
        totalTreatsCreated: state.totalTreatsCreated + 1,
        mixing: { active: false, selectedIngredients: [], progress: 0, result: newTreat, timeLimit: null, timeRemaining: null }
      };
    
    case 'RESET_MIXING':
      return {
        ...state,
        mixing: { active: false, selectedIngredients: [], progress: 0, result: null, timeLimit: null, timeRemaining: null }
      };
    
    case 'SET_WEB3_PROFILE':
      return {
        ...state,
        web3Profile: action.payload,
        labBalance: action.payload.labBalance || '0',
        nftBalance: action.payload.nftBalance || 0,
        isNFTHolder: action.payload.isNftHolder || false,
        currentSeason: action.payload.currentSeason || 0,
      };

    case 'CLEAR_WEB3_PROFILE':
      return {
        ...state,
        web3Profile: null,
        labBalance: '0',
        nftBalance: 0,
        isNFTHolder: false,
        currentSeason: 0,
      };

    case 'UPDATE_LAB_BALANCE':
      return {
        ...state,
        labBalance: action.payload,
      };

    case 'UPDATE_NFT_BALANCE':
      return {
        ...state,
        nftBalance: action.payload,
        isNFTHolder: action.payload > 0,
      };
      
    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [xpAnimation, setXpAnimation] = useState({ active: false, amount: 0 });

  const updatePlayerProgress = async (experience, points) => {
    if (state.user) {
      try {
        await axios.post(`${API}/player/progress`, {
          address: state.user.address,
          experience,
          points: state.isNFTHolder ? points : 0,
          level: state.currentLevel
        });
      } catch (error) {
        console.error('Error updating player progress:', error);
      }
    }
  };

  const checkNFTOwnership = async (address) => {
    // Mock NFT verification for prototype
    const mockNFTHolders = [
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    ];
    
    const isHolder = mockNFTHolders.includes(address.toLowerCase());
    dispatch({ type: 'SET_NFT_HOLDER', payload: isHolder });
    return isHolder;
  };

  const gainXP = (ingredients, difficulty = 1.0) => {
    // Calculate XP based on ingredients and current difficulty
    const ingredientObjects = ingredients.map(id => 
      state.ingredients.find(ing => ing.id === id)
    ).filter(Boolean);
    
    const averageRarity = ingredientObjects.length > 0 
      ? ingredientObjects[0].rarity 
      : 'common';
    
    const baseXp = calculateXP(ingredients, state.currentLevel, averageRarity);
    const finalXp = Math.floor(baseXp * difficulty);
    
    // Trigger XP animation
    setXpAnimation({ active: true, amount: finalXp });
    setTimeout(() => setXpAnimation({ active: false, amount: 0 }), gameConfig.animations.xpGainDuration);
    
    dispatch({ type: 'GAIN_XP', payload: finalXp });
    updatePlayerProgress(finalXp, 0);
    
    return finalXp;
  };

  const addPoints = (amount) => {
    dispatch({ type: 'ADD_POINTS', payload: amount });
    updatePlayerProgress(0, amount);
  };

  const startMixing = (ingredients) => {
    const currentDifficulty = calculateDifficulty(state.currentLevel);
    const timeLimit = gameConfig.difficulty.timeLimitEnabled 
      ? gameConfig.difficulty.baseTimeLimit - (state.currentLevel - 1) * gameConfig.difficulty.timePenaltyPerLevel
      : null;
      
    dispatch({ 
      type: 'START_MIXING', 
      payload: { 
        ingredients,
        timeLimit: timeLimit > 0 ? timeLimit : null
      } 
    });
  };

  const completeMixing = async (web3GameHook = null) => {
    const { selectedIngredients } = state.mixing;
    const difficulty = calculateDifficulty(state.currentLevel);
    
    // Calculate rarity based on ingredients
    const ingredientObjects = selectedIngredients.map(id => 
      state.ingredients.find(ing => ing.id === id)
    ).filter(Boolean);
    
    const rarityScore = ingredientObjects.reduce((score, ing) => {
      return score + (gameConfig.ingredients.rarityMultiplier[ing.rarity] || 1);
    }, 0);

    const rarity = rarityScore >= 8 ? 'Legendary' :
                   rarityScore >= 5 ? 'Epic' :
                   rarityScore >= 3 ? 'Rare' : 'Common';

    const treatName = `${selectedIngredients.length}-Ingredient ${rarity} Treat`;
    const flavor = ingredientObjects.map(ing => ing.name).join(' & ');

    const result = {
      name: treatName,
      rarity,
      flavor,
      image: rarityScore >= 8 ? '🌟' : 
             rarityScore >= 5 ? '⭐' :
             rarityScore >= 3 ? '✨' : '🍪'
    };

    // Complete mixing first
    dispatch({ type: 'COMPLETE_MIXING', payload: result });
    
    // Add to ingredient sack with animation
    dispatch({ 
      type: 'ADD_TO_SACK', 
      payload: { 
        ingredients: selectedIngredients,
        treatName: treatName,
        rarity: rarity
      } 
    });
    
    // Web3 Integration: Mint NFT if wallet is connected
    if (web3GameHook && typeof web3GameHook.mintTreatNFT === 'function') {
      try {
        console.log('🎨 Attempting to mint DogeFood NFT for treat creation...');
        const mintResult = await web3GameHook.mintTreatNFT();
        
        if (mintResult && mintResult.success) {
          console.log('✅ DogeFood NFT minted successfully!', mintResult);
          // Could add additional celebration here
        }
      } catch (error) {
        console.warn('⚠️ NFT minting failed (continuing with game):', error.message);
        // Don't block game progression if NFT minting fails
      }
    }
    
    // Award XP and points after a short delay for better UX
    setTimeout(() => {
      const xpGained = gainXP(selectedIngredients, difficulty);
      const pointsGained = Math.floor(xpGained * 0.5); // Points = 50% of XP
      addPoints(pointsGained);
      
      // Check if recipe is completed (enough ingredients in sack)
      if (state.mixesThisLevel + 1 >= gameConfig.sack.completionThreshold) {
        setTimeout(() => {
          // Award bonus XP first
          const bonusXp = gameConfig.sack.bonusXpPerCompletion;
          dispatch({ type: 'GAIN_XP', payload: bonusXp });
          updatePlayerProgress(bonusXp, 0);
          
          // Then complete recipe (clears sack)
          dispatch({ type: 'COMPLETE_RECIPE' });
        }, 1500);
      }
    }, 1000);
  };

  const acknowledgeLevelUp = () => {
    dispatch({ type: 'ACKNOWLEDGE_LEVEL_UP' });
  };

  return (
    <GameContext.Provider value={{
      ...state,
      dispatch,
      xpAnimation,
      currentDifficulty: calculateDifficulty(state.currentLevel),
      checkNFTOwnership,
      gainXP,
      addPoints,
      startMixing,
      completeMixing,
      acknowledgeLevelUp,
      updatePlayerProgress,
      gameConfig
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
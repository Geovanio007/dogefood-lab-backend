import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import axios from 'axios';
import { gameConfig, calculateDifficulty, calculateXP, getUnlockedIngredients, getIngredientsUnlockedAtLevel } from '../config/gameConfig';

const GameContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const initialState = {
  user: null,
  isNFTHolder: false,
  currentLevel: 1,
  experience: 0,
  xpProgress: 0, // XP progress within current level (0-100)
  points: 0,
  totalTreatsCreated: 0,
  mixesThisLevel: 0, // Track completed mixes per level for sack
  ingredients: getUnlockedIngredients(1), // Start with level 1 ingredients
  createdTreats: [],
  ingredientSack: [], // Visual ingredient sack for completed combinations
  labEquipment: {
    mixingStation: { level: 1, efficiency: 1.0 },
    freezer: { level: 1, unlocked: true },
    oven: { level: 1, unlocked: false },
    specialProcessor: { level: 0, unlocked: false }
  },
  mixing: {
    active: false,
    selectedIngredients: [],
    progress: 0,
    result: null,
    timeLimit: null,
    timeRemaining: null
  },
  levelUp: {
    justLeveledUp: false,
    newLevel: 1,
    unlockedFeatures: [],
    newIngredients: []
  }
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_NFT_HOLDER':
      return { ...state, isNFTHolder: action.payload };
    
    case 'GAIN_XP':
      const xpGained = action.payload;
      const newTotalXp = state.experience + xpGained;
      const newXpProgress = state.xpProgress + xpGained;
      const xpCapPerLevel = gameConfig.xp.xpCapPerLevel;
      
      // Check for level up
      if (newXpProgress >= xpCapPerLevel) {
        const newLevel = state.currentLevel + 1;
        const remainingXp = newXpProgress - xpCapPerLevel;
        
        // Get newly unlocked ingredients
        const newIngredients = getIngredientsUnlockedAtLevel(newLevel);
        const allUnlockedIngredients = getUnlockedIngredients(newLevel);
        
        // Unlock new features based on level
        const unlockedFeatures = [];
        
        // Add unlocked ingredients to features list
        newIngredients.forEach(ingredient => {
          unlockedFeatures.push(`${ingredient.name} ingredient`);
        });
        
        // Check for equipment unlocks
        const newLabEquipment = {
          ...state.labEquipment,
          oven: { ...state.labEquipment.oven, unlocked: newLevel >= 3 },
          specialProcessor: { ...state.labEquipment.specialProcessor, unlocked: newLevel >= 4 }
        };
        
        if (newLevel >= 3 && !state.labEquipment.oven.unlocked) {
          unlockedFeatures.push('Advanced Oven');
        }
        if (newLevel >= 4 && !state.labEquipment.specialProcessor.unlocked) {
          unlockedFeatures.push('Special Processor');
        }
        
        console.log(`🎉 LEVEL UP! Level ${newLevel} - New ingredients:`, newIngredients.map(i => i.name));
        console.log(`📋 All unlocked ingredients:`, allUnlockedIngredients.map(i => i.name));
        
        return {
          ...state,
          experience: newTotalXp,
          currentLevel: newLevel,
          xpProgress: remainingXp,
          mixesThisLevel: 0, // Reset sack counter for new level
          ingredientSack: [], // Clear sack for new level
          ingredients: allUnlockedIngredients,
          labEquipment: newLabEquipment,
          levelUp: {
            justLeveledUp: true,
            newLevel: newLevel,
            unlockedFeatures: unlockedFeatures,
            newIngredients: newIngredients
          }
        };
      }
      
      return {
        ...state,
        experience: newTotalXp,
        xpProgress: newXpProgress
      };
    
    case 'ACKNOWLEDGE_LEVEL_UP':
      return {
        ...state,
        levelUp: {
          justLeveledUp: false,
          newLevel: state.currentLevel,
          unlockedFeatures: [],
          newIngredients: []
        }
      };
    
    case 'ADD_POINTS':
      return { 
        ...state, 
        points: state.isNFTHolder ? state.points + action.payload : state.points 
      };
    
    case 'ADD_TO_SACK':
      const newSackItem = {
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

  const completeMixing = () => {
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
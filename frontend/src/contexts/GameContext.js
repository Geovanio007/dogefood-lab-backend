import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const GameContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const initialState = {
  user: null,
  isNFTHolder: false,
  currentLevel: 1,
  experience: 0,
  points: 0,
  ingredients: [
    { id: '1', name: 'Golden Kibble', type: 'base', unlocked: true, image: '🥇' },
    { id: '2', name: 'Doge Treats', type: 'flavor', unlocked: true, image: '🐕' },
    { id: '3', name: 'Moon Dust', type: 'special', unlocked: false, image: '🌙' },
    { id: '4', name: 'Rocket Fuel', type: 'special', unlocked: false, image: '🚀' },
    { id: '5', name: 'Diamond Paws', type: 'legendary', unlocked: false, image: '💎' },
  ],
  createdTreats: [],
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
    result: null
  }
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_NFT_HOLDER':
      return { ...state, isNFTHolder: action.payload };
    
    case 'ADD_EXPERIENCE':
      const newExp = state.experience + action.payload;
      const newLevel = Math.floor(newExp / 100) + 1;
      const leveledUp = newLevel > state.currentLevel;
      
      return {
        ...state,
        experience: newExp,
        currentLevel: newLevel,
        ...(leveledUp && { 
          ingredients: state.ingredients.map(ingredient => 
            ingredient.id === '3' && newLevel >= 2 ? { ...ingredient, unlocked: true } :
            ingredient.id === '4' && newLevel >= 3 ? { ...ingredient, unlocked: true } :
            ingredient.id === '5' && newLevel >= 5 ? { ...ingredient, unlocked: true } :
            ingredient
          ),
          labEquipment: {
            ...state.labEquipment,
            oven: { ...state.labEquipment.oven, unlocked: newLevel >= 3 },
            specialProcessor: { ...state.labEquipment.specialProcessor, unlocked: newLevel >= 4 }
          }
        })
      };
    
    case 'ADD_POINTS':
      return { 
        ...state, 
        points: state.isNFTHolder ? state.points + action.payload : state.points 
      };
    
    case 'START_MIXING':
      return {
        ...state,
        mixing: {
          active: true,
          selectedIngredients: action.payload.ingredients,
          progress: 0,
          result: null
        }
      };
    
    case 'UPDATE_MIXING_PROGRESS':
      return {
        ...state,
        mixing: { ...state.mixing, progress: action.payload }
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
        image: action.payload.image
      };
      
      return {
        ...state,
        createdTreats: [...state.createdTreats, newTreat],
        mixing: { active: false, selectedIngredients: [], progress: 0, result: newTreat }
      };
    
    case 'RESET_MIXING':
      return {
        ...state,
        mixing: { active: false, selectedIngredients: [], progress: 0, result: null }
      };
    
    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

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
    // In production, this would check actual NFT ownership
    const mockNFTHolders = [
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    ];
    
    const isHolder = mockNFTHolders.includes(address.toLowerCase());
    dispatch({ type: 'SET_NFT_HOLDER', payload: isHolder });
    return isHolder;
  };

  const addExperience = (amount) => {
    dispatch({ type: 'ADD_EXPERIENCE', payload: amount });
    updatePlayerProgress(amount, 0);
  };

  const addPoints = (amount) => {
    dispatch({ type: 'ADD_POINTS', payload: amount });
    updatePlayerProgress(0, amount);
  };

  const startMixing = (ingredients) => {
    dispatch({ type: 'START_MIXING', payload: { ingredients } });
  };

  const completeMixing = () => {
    const { selectedIngredients } = state.mixing;
    const rarityScore = selectedIngredients.reduce((score, ing) => {
      const ingredient = state.ingredients.find(i => i.id === ing);
      return score + (ingredient?.type === 'legendary' ? 5 : 
                     ingredient?.type === 'special' ? 3 : 1);
    }, 0);

    const rarity = rarityScore >= 10 ? 'Legendary' :
                   rarityScore >= 6 ? 'Epic' :
                   rarityScore >= 3 ? 'Rare' : 'Common';

    const treatName = `${selectedIngredients.length}-Ingredient ${rarity} Treat`;
    const flavor = selectedIngredients.map(id => 
      state.ingredients.find(ing => ing.id === id)?.name
    ).join(' & ');

    const result = {
      name: treatName,
      rarity,
      flavor,
      image: rarityScore >= 10 ? '🌟' : 
             rarityScore >= 6 ? '⭐' :
             rarityScore >= 3 ? '✨' : '🍪'
    };

    dispatch({ type: 'COMPLETE_MIXING', payload: result });
    
    // Award experience and points
    const expReward = rarityScore * 10;
    const pointsReward = rarityScore * 5;
    
    setTimeout(() => {
      addExperience(expReward);
      addPoints(pointsReward);
    }, 1000);
  };

  return (
    <GameContext.Provider value={{
      ...state,
      dispatch,
      checkNFTOwnership,
      addExperience,
      addPoints,
      startMixing,
      completeMixing,
      updatePlayerProgress
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
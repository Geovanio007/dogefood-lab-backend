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
// Enhanced GameProvider with all new functionality
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { address, isConnected } = useAccount();

  // Initialize player when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      dispatch({ type: 'SET_WALLET_ADDRESS', payload: address });
      loadPlayerData(address);
    } else {
      dispatch({ type: 'SET_REGISTRATION_STATUS', payload: false });
      dispatch({ type: 'SHOW_REGISTRATION', payload: true });
    }
  }, [isConnected, address]);

  // Enhanced API Functions
  const loadPlayerData = async (walletAddress) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await axios.get(`${API}/player/${walletAddress}`);
      if (response.status === 200) {
        dispatch({ type: 'SET_PLAYER', payload: response.data });
        dispatch({ type: 'SHOW_REGISTRATION', payload: false });
        
        // Load player's treats
        await loadPlayerTreats(walletAddress);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        // Player not registered
        dispatch({ type: 'SET_REGISTRATION_STATUS', payload: false });
        dispatch({ type: 'SHOW_REGISTRATION', payload: true });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const registerPlayer = async (walletAddress, nickname) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await axios.post(`${API}/player`, {
        address: walletAddress,
        nickname: nickname,
        is_nft_holder: true // For now, assume all registered players are NFT holders
      });
      
      if (response.status === 200) {
        dispatch({ type: 'SET_PLAYER', payload: response.data });
        dispatch({ type: 'SHOW_REGISTRATION', payload: false });
        
        showNotification({
          type: 'success',
          title: 'Registration Complete!',
          message: `Welcome to the lab, ${nickname}!`
        });
        
        return response.data;
      }
    } catch (error) {
      console.error('Registration error:', error);
      showNotification({
        type: 'error',
        title: 'Registration Failed',
        message: 'Please try again later.'
      });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const loadPlayerTreats = async (walletAddress) => {
    try {
      const response = await axios.get(`${API}/treats/${walletAddress}`);
      if (response.status === 200) {
        dispatch({ type: 'SET_TREATS', payload: response.data });
        
        // Separate brewing and ready treats
        const brewing = response.data.filter(treat => treat.brewing_status === 'brewing');
        const ready = response.data.filter(treat => treat.brewing_status === 'ready');
        
        dispatch({ type: 'UPDATE_BREWING_TREATS', payload: brewing });
        dispatch({ type: 'UPDATE_READY_TREATS', payload: ready });
      }
    } catch (error) {
      console.error('Error loading treats:', error);
    }
  };

  const createTreat = async (treatName, selectedIngredients, mainIngredient) => {
    if (!state.walletAddress || selectedIngredients.length < 2) {
      showNotification({
        type: 'error',
        title: 'Cannot Create Treat',
        message: 'Select at least 2 ingredients and connect your wallet.'
      });
      return null;
    }

    try {
      dispatch({ type: 'SET_MIXING_PROGRESS', payload: true });
      
      // Create treat name from combination
      const treatData = createTreatName(selectedIngredients, mainIngredient);
      const xpGained = calculateTreatXP(treatData.rarity, state.currentLevel);
      
      // Create treat with 3-hour timer
      const newTreatData = {
        name: treatData.name,
        creator_address: state.walletAddress,
        ingredients: selectedIngredients.map(ing => ing.id),
        main_ingredient: mainIngredient.id,
        rarity: treatData.rarity,
        flavor: 'custom',
        image: 'treat-placeholder.jpg',
        timer_duration: gameConfig.timer.treatCreationTime / 1000, // Convert to seconds
        brewing_status: 'brewing'
      };

      const response = await axios.post(`${API}/treats`, newTreatData);
      
      if (response.status === 200) {
        const createdTreat = response.data;
        dispatch({ type: 'ADD_TREAT', payload: createdTreat });
        dispatch({ type: 'CLEAR_SELECTION' });
        
        // Add XP and points
        dispatch({ type: 'GAIN_XP', payload: xpGained });
        dispatch({ type: 'ADD_POINTS', payload: xpGained * 2 });
        
        // Update player progress on backend
        await updatePlayerProgress(xpGained, xpGained * 2);
        
        // Add timer for this treat
        const timer = {
          treatId: createdTreat.id,
          startTime: Date.now(),
          duration: gameConfig.timer.treatCreationTime,
          treatName: treatData.name
        };
        dispatch({ type: 'ADD_TIMER', payload: timer });
        
        showNotification({
          type: 'success',
          title: 'Treat Created!',
          message: `${treatData.name} is now brewing! It will be ready in 3 hours.`,
          duration: 5000
        });
        
        return createdTreat;
      }
    } catch (error) {
      console.error('Error creating treat:', error);
      showNotification({
        type: 'error',
        title: 'Creation Failed',
        message: 'Failed to create treat. Please try again.'
      });
    } finally {
      dispatch({ type: 'SET_MIXING_PROGRESS', payload: false });
    }
    
    return null;
  };

  const checkBrewingTreats = async () => {
    if (!state.walletAddress) return;
    
    try {
      const response = await axios.get(`${API}/treats/${state.walletAddress}/brewing`);
      if (response.status === 200) {
        dispatch({ type: 'UPDATE_BREWING_TREATS', payload: response.data });
      }
    } catch (error) {
      console.error('Error checking brewing treats:', error);
    }
  };

  const updatePlayerProgress = async (experience, points) => {
    if (!state.walletAddress) return;
    
    try {
      await axios.post(`${API}/player/progress`, {
        address: state.walletAddress,
        experience,
        points: state.isNFTHolder ? points : 0,
        level: state.currentLevel
      });
    } catch (error) {
      console.error('Error updating player progress:', error);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await axios.get(`${API}/leaderboard?limit=50`);
      if (response.status === 200) {
        dispatch({ type: 'SET_LEADERBOARD', payload: response.data });
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const showNotification = (notification) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    
    // Auto-remove notification after duration
    setTimeout(() => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id || Date.now() });
    }, notification.duration || 3000);
  };

  const selectIngredient = (ingredient) => {
    dispatch({ type: 'SELECT_INGREDIENT', payload: ingredient });
  };

  const selectMainIngredient = (ingredient) => {
    dispatch({ type: 'SELECT_MAIN_INGREDIENT', payload: ingredient });
  };

  const clearSelection = () => {
    dispatch({ type: 'CLEAR_SELECTION' });
  };

  const shuffleIngredients = () => {
    dispatch({ type: 'SHUFFLE_INGREDIENTS' });
    showNotification({
      type: 'info',
      title: 'Ingredients Refreshed!',
      message: 'New ingredients are available for mixing.'
    });
  };

  // Timer management
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.activeTimers.length > 0) {
        checkBrewingTreats();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [state.activeTimers]);

  const value = {
    // State
    ...state,
    
    // Actions
    registerPlayer,
    createTreat,
    loadPlayerData,
    loadPlayerTreats,
    loadLeaderboard,
    selectIngredient,
    selectMainIngredient,
    clearSelection,
    shuffleIngredients,
    showNotification,
    checkBrewingTreats,
    
    // Utilities
    canCreateTreat: state.selectedIngredients.length >= 2 && state.selectedMainIngredient && !state.mixingInProgress,
    isRegistered: state.isRegistered && state.walletAddress,
    needsRegistration: !state.isRegistered && state.walletAddress
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};


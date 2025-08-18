import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/ui/use-toast';

/**
 * Custom hook for tracking active treats with real-time updates and persistence
 */
export const useTreatTracker = (playerAddress, demoMode = false) => {
  const [activeTreats, setActiveTreats] = useState([]);
  const [completedTreats, setCompletedTreats] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Load treats from backend
  const loadTreats = useCallback(async () => {
    if (!playerAddress || demoMode) return;

    try {
      setLoading(true);
      
      // Load active (brewing) treats
      const brewingResponse = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/treats/${playerAddress}/brewing`
      );
      
      if (brewingResponse.ok) {
        const brewingData = await brewingResponse.json();
        setActiveTreats(brewingData.treats || []);
      }

      // Load all treats for this player
      const allTreatsResponse = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/treats/${playerAddress}`
      );
      
      if (allTreatsResponse.ok) {
        const allTreatsData = await allTreatsResponse.json();
        const completed = allTreatsData.treats?.filter(treat => treat.brewing_status === 'ready') || [];
        setCompletedTreats(completed);
      }

    } catch (error) {
      console.error('Error loading treats:', error);
    } finally {
      setLoading(false);
    }
  }, [playerAddress, demoMode]);

  // Check treat status for a specific treat
  const checkTreatStatus = useCallback(async (treatId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/treats/${treatId}/check-timer`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error checking treat status:', error);
    }
    return null;
  }, []);

  // Add a new treat to tracking
  const addTreat = useCallback((treatData) => {
    if (demoMode) {
      // In demo mode, just add to local state without persistence
      const newTreat = {
        id: treatData.id || Date.now().toString(),
        name: treatData.name,
        rarity: treatData.rarity,
        ingredients: treatData.ingredients,
        created_at: new Date().toISOString(),
        ready_at: treatData.ready_at,
        brewing_status: 'brewing',
        timer_duration: treatData.timer_duration || 3600,
        image: treatData.image || '🍖'
      };
      setActiveTreats(prev => [...prev, newTreat]);
      return newTreat;
    }

    const newTreat = {
      id: treatData.id,
      name: treatData.name,
      rarity: treatData.rarity,
      ingredients: treatData.ingredients,
      created_at: new Date().toISOString(),
      ready_at: treatData.ready_at,
      brewing_status: 'brewing',
      timer_duration: treatData.timer_duration || 3600, // Default 1 hour
      image: treatData.image || '🍖'
    };

    setActiveTreats(prev => [...prev, newTreat]);
    
    // Store in localStorage for persistence (only in real mode)
    if (playerAddress) {
      const storageKey = `treats_${playerAddress}`;
      const existingTreats = JSON.parse(localStorage.getItem(storageKey) || '[]');
      existingTreats.push(newTreat);
      localStorage.setItem(storageKey, JSON.stringify(existingTreats));
    }

    return newTreat;
  }, [playerAddress, demoMode]);

  // Mark treat as completed
  const completeTreat = useCallback((treatId) => {
    setActiveTreats(prev => {
      const updated = prev.map(treat => {
        if (treat.id === treatId) {
          return { ...treat, brewing_status: 'ready' };
        }
        return treat;
      });
      return updated.filter(treat => treat.brewing_status === 'brewing');
    });

    // Move to completed treats
    setCompletedTreats(prev => {
      const treatToComplete = activeTreats.find(t => t.id === treatId);
      if (treatToComplete) {
        const completedTreat = { ...treatToComplete, brewing_status: 'ready' };
        return [...prev, completedTreat];
      }
      return prev;
    });

    // Show notification
    toast({
      title: "Treat Ready! 🎉",
      description: "Your treat has finished brewing and is ready to collect!",
      className: "bg-green-100 border-green-400"
    });
  }, [activeTreats, toast]);

  // Calculate time remaining for a treat
  const getTimeRemaining = useCallback((readyAt) => {
    const now = new Date().getTime();
    const ready = new Date(readyAt).getTime();
    const remaining = ready - now;

    if (remaining <= 0) return { hours: 0, minutes: 0, seconds: 0, isReady: true };

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, isReady: false };
  }, []);

  // Real-time timer updates
  useEffect(() => {
    if (activeTreats.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      activeTreats.forEach(treat => {
        const readyTime = new Date(treat.ready_at).getTime();
        
        if (now >= readyTime && treat.brewing_status === 'brewing') {
          completeTreat(treat.id);
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTreats, completeTreat]);

  // Load treats when player address changes
  useEffect(() => {
    if (playerAddress && !demoMode) {
      // Load from localStorage first for immediate display
      const storageKey = `treats_${playerAddress}`;
      const storedTreats = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      // Filter active vs completed
      const now = new Date().getTime();
      const active = storedTreats.filter(treat => {
        const readyTime = new Date(treat.ready_at).getTime();
        return now < readyTime && treat.brewing_status === 'brewing';
      });
      const completed = storedTreats.filter(treat => {
        const readyTime = new Date(treat.ready_at).getTime();
        return now >= readyTime || treat.brewing_status === 'ready';
      });

      setActiveTreats(active);
      setCompletedTreats(completed);

      // Then load from backend
      loadTreats();
    } else if (demoMode) {
      // Clear treats in demo mode
      setActiveTreats([]);
      setCompletedTreats([]);
    }
  }, [playerAddress, demoMode, loadTreats]);

  return {
    activeTreats,
    completedTreats,
    loading,
    addTreat,
    completeTreat,
    checkTreatStatus,
    getTimeRemaining,
    loadTreats
  };
};
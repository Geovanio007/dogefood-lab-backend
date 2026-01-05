import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

// Audio source - Only lab ambient music
const LAB_AMBIENT_URL = 'https://customer-assets.emergentagent.com/job_5412b27a-14e8-4bc6-a510-b262ffc85132/artifacts/e6xj38of_magical-technology-sci-fi-science-futuristic-game-music-300607.mp3';

export const AudioProvider = ({ children }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('dogefood_sound_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [musicVolume, setMusicVolume] = useState(() => {
    const saved = localStorage.getItem('dogefood_music_volume');
    return saved !== null ? parseInt(saved) : 75;
  });
  
  const [effectsVolume, setEffectsVolume] = useState(() => {
    const saved = localStorage.getItem('dogefood_effects_volume');
    return saved !== null ? parseInt(saved) : 80;
  });

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const labAmbientRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Initialize audio elements
  const initializeAudio = useCallback(() => {
    if (isInitializedRef.current) return;
    
    console.log('🔊 Initializing audio system...');
    
    try {
      // Lab ambient music
      labAmbientRef.current = new Audio(LAB_AMBIENT_URL);
      labAmbientRef.current.loop = true;
      labAmbientRef.current.volume = (musicVolume / 100) * 0.5;
      labAmbientRef.current.preload = 'auto';
      
      isInitializedRef.current = true;
      console.log('✅ Audio system initialized');
    } catch (error) {
      console.error('❌ Error initializing audio:', error);
    }
  }, [musicVolume]);

  // Initialize on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initializeAudio();
    };
    
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [initializeAudio]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('dogefood_sound_enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('dogefood_music_volume', musicVolume.toString());
    if (labAmbientRef.current) {
      labAmbientRef.current.volume = (musicVolume / 100) * 0.5;
    }
  }, [musicVolume]);

  useEffect(() => {
    localStorage.setItem('dogefood_effects_volume', effectsVolume.toString());
  }, [effectsVolume]);

  // Start lab ambient sounds (the main game music)
  const startLabAmbient = useCallback(async () => {
    if (!soundEnabled) return false;
    
    initializeAudio();
    
    try {
      if (labAmbientRef.current) {
        labAmbientRef.current.currentTime = 0;
        labAmbientRef.current.volume = (musicVolume / 100) * 0.5;
        await labAmbientRef.current.play();
        setIsMusicPlaying(true);
        console.log('🧪 Lab ambient music started');
        return true;
      }
    } catch (error) {
      console.warn('Lab ambient play failed:', error.message);
      return false;
    }
    return false;
  }, [soundEnabled, musicVolume, initializeAudio]);

  // Stop lab ambient
  const stopLabAmbient = useCallback(() => {
    if (labAmbientRef.current) {
      labAmbientRef.current.pause();
      labAmbientRef.current.currentTime = 0;
      setIsMusicPlaying(false);
      console.log('🔇 Lab ambient music stopped');
    }
  }, []);

  // Backward compatibility - these do nothing now
  const startBackgroundMusic = useCallback(async () => {
    // No longer used - keeping for backward compatibility
    return false;
  }, []);

  const stopBackgroundMusic = useCallback(() => {
    // No longer used - keeping for backward compatibility
  }, []);

  // No-op sound effects (keeping for backward compatibility)
  const playClick = useCallback(() => {}, []);
  const playSuccess = useCallback(() => {}, []);
  const playMix = useCallback(() => {}, []);
  const playCollect = useCallback(() => {}, []);
  const playRare = useCallback(() => {}, []);
  const playLevelUp = useCallback(() => {}, []);
  const playEffect = useCallback(() => {}, []);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      if (!newValue) {
        stopLabAmbient();
      }
      return newValue;
    });
  }, [stopLabAmbient]);

  const value = {
    // State
    soundEnabled,
    musicVolume,
    effectsVolume,
    isMusicPlaying,
    
    // Setters
    setSoundEnabled,
    setMusicVolume,
    setEffectsVolume,
    toggleSound,
    
    // Music controls
    startBackgroundMusic,
    stopBackgroundMusic,
    startLabAmbient,
    stopLabAmbient,
    
    // Effect sounds (no-op for backward compatibility)
    playClick,
    playSuccess,
    playMix,
    playCollect,
    playRare,
    playLevelUp,
    playEffect,
    
    // Manual init
    initializeAudio
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    // Return a no-op version if not in provider
    return {
      soundEnabled: false,
      musicVolume: 75,
      effectsVolume: 80,
      isMusicPlaying: false,
      setSoundEnabled: () => {},
      setMusicVolume: () => {},
      setEffectsVolume: () => {},
      toggleSound: () => {},
      startBackgroundMusic: () => {},
      stopBackgroundMusic: () => {},
      startLabAmbient: () => {},
      stopLabAmbient: () => {},
      playClick: () => {},
      playSuccess: () => {},
      playMix: () => {},
      playCollect: () => {},
      playRare: () => {},
      playLevelUp: () => {},
      playEffect: () => {},
      initializeAudio: () => {}
    };
  }
  return context;
};

export default AudioContext;

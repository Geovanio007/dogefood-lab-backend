import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

// Audio sources - Lab ambient and sound effects
const LAB_AMBIENT_URL = 'https://customer-assets.emergentagent.com/job_5412b27a-14e8-4bc6-a510-b262ffc85132/artifacts/e6xj38of_magical-technology-sci-fi-science-futuristic-game-music-300607.mp3';

// Sound effect URLs - using reliable, CORS-enabled sources
const SOUND_EFFECTS = {
  click: 'https://cdn.freesound.org/previews/220/220206_4100837-lq.mp3',       // UI click sound
  brewing: 'https://cdn.freesound.org/previews/398/398719_1676145-lq.mp3',    // Bubbling/brewing
  success: 'https://cdn.freesound.org/previews/320/320775_5260872-lq.mp3',    // Success chime
  rare: 'https://cdn.freesound.org/previews/270/270404_5123851-lq.mp3',       // Rare item found
  collect: 'https://cdn.freesound.org/previews/341/341695_5858296-lq.mp3',    // Collect/pickup
  levelUp: 'https://cdn.freesound.org/previews/270/270319_5123851-lq.mp3',    // Level up fanfare
};

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
  const soundEffectsRef = useRef({});
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
      
      // Initialize sound effects
      Object.entries(SOUND_EFFECTS).forEach(([key, url]) => {
        const audio = new Audio(url);
        audio.volume = (effectsVolume / 100) * 0.7;
        audio.preload = 'auto';
        soundEffectsRef.current[key] = audio;
      });
      
      isInitializedRef.current = true;
      console.log('✅ Audio system initialized with sound effects');
    } catch (error) {
      console.error('❌ Error initializing audio:', error);
    }
  }, [musicVolume, effectsVolume]);

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
    // Update all sound effect volumes
    Object.values(soundEffectsRef.current).forEach(audio => {
      if (audio) audio.volume = (effectsVolume / 100) * 0.7;
    });
  }, [effectsVolume]);

  // Generic sound effect player
  const playSound = useCallback((soundKey) => {
    if (!soundEnabled) return;
    
    initializeAudio();
    
    try {
      const audio = soundEffectsRef.current[soundKey];
      if (audio) {
        // Clone and play to allow overlapping sounds
        const clone = audio.cloneNode();
        clone.volume = (effectsVolume / 100) * 0.7;
        clone.play().catch(e => console.warn(`Sound ${soundKey} play failed:`, e.message));
      }
    } catch (error) {
      console.warn(`Error playing ${soundKey}:`, error.message);
    }
  }, [soundEnabled, effectsVolume, initializeAudio]);

  // Sound effect functions
  const playClick = useCallback(() => {
    playSound('click');
  }, [playSound]);

  const playBrewing = useCallback(() => {
    playSound('brewing');
  }, [playSound]);

  const playSuccess = useCallback(() => {
    playSound('success');
  }, [playSound]);

  const playRare = useCallback(() => {
    playSound('rare');
  }, [playSound]);

  const playCollect = useCallback(() => {
    playSound('collect');
  }, [playSound]);

  const playLevelUp = useCallback(() => {
    playSound('levelUp');
  }, [playSound]);

  // Alias for backward compatibility
  const playMix = useCallback(() => {
    playSound('brewing');
  }, [playSound]);

  // Generic effect player (can play any sound by name)
  const playEffect = useCallback((effectName) => {
    playSound(effectName);
  }, [playSound]);

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
    
    // Effect sounds
    playClick,
    playBrewing,
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
      playBrewing: () => {},
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

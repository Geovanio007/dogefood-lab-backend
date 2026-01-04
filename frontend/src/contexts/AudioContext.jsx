import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

// Audio URLs - using free sound effects
const AUDIO_SOURCES = {
  background: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
  labAmbient: 'https://assets.mixkit.co/sfx/preview/mixkit-laboratory-bubbling-2404.mp3',
  click: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
  success: 'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3',
  mix: 'https://assets.mixkit.co/sfx/preview/mixkit-bubbles-popping-in-water-88.mp3',
  collect: 'https://assets.mixkit.co/sfx/preview/mixkit-bonus-earned-in-video-game-2058.mp3',
  rare: 'https://assets.mixkit.co/sfx/preview/mixkit-magical-coin-win-1936.mp3',
  levelUp: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3'
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

  const backgroundMusicRef = useRef(null);
  const labAmbientRef = useRef(null);
  const effectsRef = useRef({});
  const isInitializedRef = useRef(false);

  // Initialize audio elements
  const initializeAudio = useCallback(() => {
    if (isInitializedRef.current) return;
    
    try {
      // Background music
      backgroundMusicRef.current = new Audio(AUDIO_SOURCES.background);
      backgroundMusicRef.current.loop = true;
      backgroundMusicRef.current.volume = (musicVolume / 100) * 0.3; // Lower base volume for bg music
      
      // Lab ambient sounds
      labAmbientRef.current = new Audio(AUDIO_SOURCES.labAmbient);
      labAmbientRef.current.loop = true;
      labAmbientRef.current.volume = (musicVolume / 100) * 0.2;
      
      // Effect sounds
      Object.keys(AUDIO_SOURCES).forEach(key => {
        if (key !== 'background' && key !== 'labAmbient') {
          effectsRef.current[key] = new Audio(AUDIO_SOURCES[key]);
          effectsRef.current[key].volume = effectsVolume / 100;
        }
      });
      
      isInitializedRef.current = true;
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  }, [musicVolume, effectsVolume]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('dogefood_sound_enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('dogefood_music_volume', musicVolume.toString());
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.volume = (musicVolume / 100) * 0.3;
    }
    if (labAmbientRef.current) {
      labAmbientRef.current.volume = (musicVolume / 100) * 0.2;
    }
  }, [musicVolume]);

  useEffect(() => {
    localStorage.setItem('dogefood_effects_volume', effectsVolume.toString());
    Object.values(effectsRef.current).forEach(audio => {
      if (audio) audio.volume = effectsVolume / 100;
    });
  }, [effectsVolume]);

  // Start background music
  const startBackgroundMusic = useCallback(async () => {
    if (!soundEnabled) return;
    initializeAudio();
    
    try {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.volume = (musicVolume / 100) * 0.3;
        await backgroundMusicRef.current.play();
      }
    } catch (error) {
      console.log('Background music autoplay blocked:', error.message);
    }
  }, [soundEnabled, musicVolume, initializeAudio]);

  // Stop background music
  const stopBackgroundMusic = useCallback(() => {
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
  }, []);

  // Start lab ambient sounds
  const startLabAmbient = useCallback(async () => {
    if (!soundEnabled) return;
    initializeAudio();
    
    try {
      if (labAmbientRef.current) {
        labAmbientRef.current.volume = (musicVolume / 100) * 0.2;
        await labAmbientRef.current.play();
      }
    } catch (error) {
      console.log('Lab ambient autoplay blocked:', error.message);
    }
  }, [soundEnabled, musicVolume, initializeAudio]);

  // Stop lab ambient
  const stopLabAmbient = useCallback(() => {
    if (labAmbientRef.current) {
      labAmbientRef.current.pause();
      labAmbientRef.current.currentTime = 0;
    }
  }, []);

  // Play effect sound
  const playEffect = useCallback((effectName) => {
    if (!soundEnabled) return;
    initializeAudio();
    
    try {
      const effect = effectsRef.current[effectName];
      if (effect) {
        effect.currentTime = 0;
        effect.volume = effectsVolume / 100;
        effect.play().catch(e => console.log('Effect play blocked:', e.message));
      }
    } catch (error) {
      console.log('Error playing effect:', error.message);
    }
  }, [soundEnabled, effectsVolume, initializeAudio]);

  // Play click sound
  const playClick = useCallback(() => playEffect('click'), [playEffect]);
  
  // Play success sound
  const playSuccess = useCallback(() => playEffect('success'), [playEffect]);
  
  // Play mix/brewing sound
  const playMix = useCallback(() => playEffect('mix'), [playEffect]);
  
  // Play collect sound
  const playCollect = useCallback(() => playEffect('collect'), [playEffect]);
  
  // Play rare treat sound
  const playRare = useCallback(() => playEffect('rare'), [playEffect]);
  
  // Play level up sound
  const playLevelUp = useCallback(() => playEffect('levelUp'), [playEffect]);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      if (!newValue) {
        stopBackgroundMusic();
        stopLabAmbient();
      }
      return newValue;
    });
  }, [stopBackgroundMusic, stopLabAmbient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBackgroundMusic();
      stopLabAmbient();
    };
  }, [stopBackgroundMusic, stopLabAmbient]);

  const value = {
    // State
    soundEnabled,
    musicVolume,
    effectsVolume,
    
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
    playSuccess,
    playMix,
    playCollect,
    playRare,
    playLevelUp,
    playEffect
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
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export default AudioContext;

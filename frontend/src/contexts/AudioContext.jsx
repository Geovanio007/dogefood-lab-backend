import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

// Audio sources - Lab ambient and sound effects
const LAB_AMBIENT_URL = 'https://customer-assets.emergentagent.com/job_5412b27a-14e8-4bc6-a510-b262ffc85132/artifacts/e6xj38of_magical-technology-sci-fi-science-futuristic-game-music-300607.mp3';

// Sound effect URLs - using local files for reliability
const SOUND_EFFECTS = {
  click: '/sounds/click.wav',
  brewing: '/sounds/brewing.wav',
  success: '/sounds/success.wav',
  rare: '/sounds/rare.wav',
  collect: '/sounds/collect.wav',
  levelUp: '/sounds/levelup.wav',
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
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const labAmbientRef = useRef(null);
  const soundEffectsRef = useRef({});
  const audioContextRef = useRef(null);

  // Create and resume Web Audio API context on user interaction
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return true;
    
    try {
      // Create Web Audio API context if not exists
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      
      // Resume suspended audio context
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      console.log('🔓 Audio unlocked successfully');
      setAudioUnlocked(true);
      return true;
    } catch (error) {
      console.warn('Failed to unlock audio:', error.message);
      return false;
    }
  }, [audioUnlocked]);

  // Initialize audio elements (preload)
  const initializeAudio = useCallback(() => {
    console.log('🔊 Initializing audio system...');
    
    try {
      // Lab ambient music
      if (!labAmbientRef.current) {
        labAmbientRef.current = new Audio(LAB_AMBIENT_URL);
        labAmbientRef.current.loop = true;
        labAmbientRef.current.volume = (musicVolume / 100) * 0.5;
        labAmbientRef.current.preload = 'auto';
      }
      
      // Initialize sound effects
      Object.entries(SOUND_EFFECTS).forEach(([key, url]) => {
        if (!soundEffectsRef.current[key]) {
          const audio = new Audio(url);
          audio.volume = (effectsVolume / 100) * 0.5;
          audio.preload = 'auto';
          soundEffectsRef.current[key] = audio;
        }
      });
      
      console.log('✅ Audio elements initialized');
    } catch (error) {
      console.error('❌ Error initializing audio:', error);
    }
  }, [musicVolume, effectsVolume]);

  // Initialize audio on mount
  useEffect(() => {
    initializeAudio();
  }, [initializeAudio]);

  // Unlock audio on first user interaction
  useEffect(() => {
    const handleInteraction = async () => {
      await unlockAudio();
    };
    
    // Listen for various user interactions to unlock audio
    const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, handleInteraction, { once: true, passive: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleInteraction);
      });
    };
  }, [unlockAudio]);

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
    Object.values(soundEffectsRef.current).forEach(audio => {
      if (audio) audio.volume = (effectsVolume / 100) * 0.5;
    });
  }, [effectsVolume]);

  // Generic sound effect player with proper unlock handling
  const playSound = useCallback(async (soundKey) => {
    if (!soundEnabled) return;
    
    // Attempt to unlock audio first
    await unlockAudio();
    
    try {
      const audio = soundEffectsRef.current[soundKey];
      if (audio) {
        // Clone the audio for overlapping sounds
        const clone = audio.cloneNode();
        clone.volume = (effectsVolume / 100) * 0.5;
        
        // Play and handle promise
        const playPromise = clone.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`🔊 Playing sound: ${soundKey}`);
            })
            .catch(e => {
              // Silently fail - this is expected on first interaction
              console.debug(`Sound ${soundKey} blocked:`, e.message);
            });
        }
      } else {
        console.warn(`Sound effect ${soundKey} not loaded`);
      }
    } catch (error) {
      console.debug(`Error playing ${soundKey}:`, error.message);
    }
  }, [soundEnabled, effectsVolume, unlockAudio]);

  // Sound effect functions
  const playClick = useCallback(() => playSound('click'), [playSound]);
  const playBrewing = useCallback(() => playSound('brewing'), [playSound]);
  const playSuccess = useCallback(() => playSound('success'), [playSound]);
  const playRare = useCallback(() => playSound('rare'), [playSound]);
  const playCollect = useCallback(() => playSound('collect'), [playSound]);
  const playLevelUp = useCallback(() => playSound('levelUp'), [playSound]);
  const playMix = useCallback(() => playSound('brewing'), [playSound]);
  const playEffect = useCallback((effectName) => playSound(effectName), [playSound]);

  // Start lab ambient sounds
  const startLabAmbient = useCallback(async () => {
    if (!soundEnabled) return false;
    
    // Unlock audio first
    const unlocked = await unlockAudio();
    if (!unlocked) return false;
    
    try {
      if (labAmbientRef.current) {
        labAmbientRef.current.currentTime = 0;
        labAmbientRef.current.volume = (musicVolume / 100) * 0.5;
        await labAmbientRef.current.play();
        setIsMusicPlaying(true);
        console.log('🎵 Lab ambient music started');
        return true;
      }
    } catch (error) {
      console.warn('Lab ambient play failed:', error.message);
      return false;
    }
    return false;
  }, [soundEnabled, musicVolume, unlockAudio]);

  // Stop lab ambient
  const stopLabAmbient = useCallback(() => {
    if (labAmbientRef.current) {
      labAmbientRef.current.pause();
      labAmbientRef.current.currentTime = 0;
      setIsMusicPlaying(false);
      console.log('🔇 Lab ambient music stopped');
    }
  }, []);

  // Backward compatibility
  const startBackgroundMusic = useCallback(async () => false, []);
  const stopBackgroundMusic = useCallback(() => {}, []);

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
    soundEnabled,
    musicVolume,
    effectsVolume,
    isMusicPlaying,
    audioUnlocked,
    
    setSoundEnabled,
    setMusicVolume,
    setEffectsVolume,
    toggleSound,
    
    startBackgroundMusic,
    stopBackgroundMusic,
    startLabAmbient,
    stopLabAmbient,
    
    playClick,
    playBrewing,
    playSuccess,
    playMix,
    playCollect,
    playRare,
    playLevelUp,
    playEffect,
    
    unlockAudio,
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
    return {
      soundEnabled: false,
      musicVolume: 75,
      effectsVolume: 80,
      isMusicPlaying: false,
      audioUnlocked: false,
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
      unlockAudio: () => {},
      initializeAudio: () => {}
    };
  }
  return context;
};

export default AudioContext;

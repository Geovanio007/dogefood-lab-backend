import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

// Use hosted sound URLs for reliable playback
const SOUND_URLS = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  brewing: 'https://customer-assets.emergentagent.com/job_audiorank-verify/artifacts/rndhcfwa_cauldron-boiling-173607.mp3',
  success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  rare: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  collect: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  levelUp: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
};

// Lab ambient music
const LAB_AMBIENT_URL = 'https://customer-assets.emergentagent.com/job_e7bcdee9-252d-418c-ba9f-7ff6fd76e17b/artifacts/5jjnqdg0_magical-technology-sci-fi-science-futuristic-game-music-300607.mp3';

export const AudioProvider = ({ children }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('dogefood_sound_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [effectsVolume, setEffectsVolume] = useState(() => {
    const saved = localStorage.getItem('dogefood_effects_volume');
    return saved !== null ? parseInt(saved) : 80;
  });
  
  const [musicVolume, setMusicVolume] = useState(() => {
    const saved = localStorage.getItem('dogefood_lab_music_volume');
    return saved !== null ? parseInt(saved) : 50;
  });

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // Audio elements cache
  const soundsRef = useRef({});
  const labMusicRef = useRef(null);

  // Preload sounds using Audio elements
  const preloadSounds = useCallback(() => {
    console.log('🔊 Preloading game sounds...');
    Object.entries(SOUND_URLS).forEach(([key, url]) => {
      if (!soundsRef.current[key]) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.volume = 0.5;
        soundsRef.current[key] = audio;
        
        audio.addEventListener('canplaythrough', () => {
          console.log(`✅ Sound ready: ${key}`);
        });
        
        audio.addEventListener('error', (e) => {
          console.error(`❌ Failed to load ${key}:`, e);
        });
      }
    });
  }, []);

  // Unlock audio on user interaction
  const unlockAudio = useCallback(async () => {
    if (isUnlocked) return true;
    
    try {
      // Play and immediately pause each sound to unlock
      const unlockPromises = Object.values(soundsRef.current).map(async (audio) => {
        try {
          audio.volume = 0;
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0.5;
        } catch (e) {
          // Ignore errors during unlock
        }
      });
      
      await Promise.all(unlockPromises);
      setIsUnlocked(true);
      console.log('🔓 Audio system unlocked!');
      return true;
    } catch (error) {
      console.warn('Failed to unlock audio:', error);
      return false;
    }
  }, [isUnlocked]);

  // Initialize on mount
  useEffect(() => {
    preloadSounds();
  }, [preloadSounds]);

  // Listen for user interaction to unlock audio
  useEffect(() => {
    const handleInteraction = async () => {
      await unlockAudio();
    };
    
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, handleInteraction, { once: true, passive: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleInteraction);
      });
    };
  }, [unlockAudio]);

  // Play sound effect
  const playSound = useCallback(async (soundKey) => {
    if (!soundEnabled) {
      return;
    }
    
    try {
      const audio = soundsRef.current[soundKey];
      if (!audio) {
        console.warn(`Sound not found: ${soundKey}`);
        return;
      }
      
      // Clone for overlapping sounds
      const clone = audio.cloneNode();
      clone.volume = (effectsVolume / 100) * 0.6;
      
      clone.play().then(() => {
        console.log(`🔊 Playing: ${soundKey}`);
      }).catch((e) => {
        console.warn(`Sound play failed: ${soundKey}`, e.message);
      });
      
    } catch (error) {
      console.error(`Error playing ${soundKey}:`, error);
    }
  }, [soundEnabled, effectsVolume]);

  // Sound effect shortcuts
  const playClick = useCallback(() => playSound('click'), [playSound]);
  const playBrewing = useCallback(() => playSound('brewing'), [playSound]);
  const playSuccess = useCallback(() => playSound('success'), [playSound]);
  const playRare = useCallback(() => playSound('rare'), [playSound]);
  const playCollect = useCallback(() => playSound('collect'), [playSound]);
  const playLevelUp = useCallback(() => playSound('levelUp'), [playSound]);
  const playMix = useCallback(() => playSound('brewing'), [playSound]);
  const playEffect = useCallback((name) => playSound(name), [playSound]);

  // Lab ambient music controls
  const startLabAmbient = useCallback(async () => {
    if (!soundEnabled) return false;
    
    try {
      if (!labMusicRef.current) {
        labMusicRef.current = new Audio(LAB_AMBIENT_URL);
        labMusicRef.current.loop = true;
      }
      
      labMusicRef.current.volume = (musicVolume / 100) * 0.3;
      await labMusicRef.current.play();
      setIsMusicPlaying(true);
      console.log('🎵 Lab ambient started');
      return true;
    } catch (error) {
      console.warn('Failed to start lab ambient:', error);
      return false;
    }
  }, [soundEnabled, musicVolume]);

  const stopLabAmbient = useCallback(() => {
    if (labMusicRef.current) {
      labMusicRef.current.pause();
      labMusicRef.current.currentTime = 0;
      setIsMusicPlaying(false);
      console.log('🔇 Lab ambient stopped');
    }
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('dogefood_sound_enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('dogefood_effects_volume', effectsVolume.toString());
  }, [effectsVolume]);

  useEffect(() => {
    localStorage.setItem('dogefood_music_volume', musicVolume.toString());
    if (labMusicRef.current) {
      labMusicRef.current.volume = (musicVolume / 100) * 0.3;
    }
  }, [musicVolume]);

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

  // Backward compatibility
  const startBackgroundMusic = useCallback(async () => false, []);
  const stopBackgroundMusic = useCallback(() => {}, []);

  const value = {
    soundEnabled,
    effectsVolume,
    musicVolume,
    isMusicPlaying,
    audioUnlocked: isUnlocked,
    
    setSoundEnabled,
    setEffectsVolume,
    setMusicVolume,
    toggleSound,
    
    playClick,
    playBrewing,
    playSuccess,
    playRare,
    playCollect,
    playLevelUp,
    playMix,
    playEffect,
    
    startLabAmbient,
    stopLabAmbient,
    startBackgroundMusic,
    stopBackgroundMusic,
    
    unlockAudio,
    initializeAudio: preloadSounds
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
      effectsVolume: 80,
      musicVolume: 50,
      isMusicPlaying: false,
      audioUnlocked: false,
      setSoundEnabled: () => {},
      setEffectsVolume: () => {},
      setMusicVolume: () => {},
      toggleSound: () => {},
      playClick: () => {},
      playBrewing: () => {},
      playSuccess: () => {},
      playRare: () => {},
      playCollect: () => {},
      playLevelUp: () => {},
      playMix: () => {},
      playEffect: () => {},
      startLabAmbient: () => {},
      stopLabAmbient: () => {},
      startBackgroundMusic: () => {},
      stopBackgroundMusic: () => {},
      unlockAudio: () => {},
      initializeAudio: () => {}
    };
  }
  return context;
};

export default AudioContext;

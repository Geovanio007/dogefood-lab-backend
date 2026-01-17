import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

// Sound effect configurations
const SOUND_CONFIG = {
  click: { url: '/sounds/click.wav', volume: 0.4 },
  brewing: { url: '/sounds/brewing.wav', volume: 0.5 },
  success: { url: '/sounds/success.wav', volume: 0.6 },
  rare: { url: '/sounds/rare.wav', volume: 0.7 },
  collect: { url: '/sounds/collect.wav', volume: 0.5 },
  levelUp: { url: '/sounds/levelup.wav', volume: 0.7 },
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
    const saved = localStorage.getItem('dogefood_music_volume');
    return saved !== null ? parseInt(saved) : 50;
  });

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // Audio buffers cache
  const audioBuffersRef = useRef({});
  const webAudioContextRef = useRef(null);
  const labMusicRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Get or create Web Audio Context
  const getAudioContext = useCallback(() => {
    if (!webAudioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      webAudioContextRef.current = new AudioCtx();
      
      // Create master gain node
      gainNodeRef.current = webAudioContextRef.current.createGain();
      gainNodeRef.current.connect(webAudioContextRef.current.destination);
      gainNodeRef.current.gain.value = effectsVolume / 100;
    }
    return webAudioContextRef.current;
  }, [effectsVolume]);

  // Unlock audio on user interaction
  const unlockAudio = useCallback(async () => {
    if (isUnlocked) return true;
    
    try {
      const ctx = getAudioContext();
      
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      // Play a silent buffer to fully unlock
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      
      setIsUnlocked(true);
      console.log('🔓 Audio system unlocked!');
      return true;
    } catch (error) {
      console.warn('Failed to unlock audio:', error);
      return false;
    }
  }, [isUnlocked, getAudioContext]);

  // Load audio buffer
  const loadAudioBuffer = useCallback(async (soundKey) => {
    if (audioBuffersRef.current[soundKey]) {
      return audioBuffersRef.current[soundKey];
    }
    
    const config = SOUND_CONFIG[soundKey];
    if (!config) return null;
    
    try {
      const ctx = getAudioContext();
      const response = await fetch(config.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      audioBuffersRef.current[soundKey] = audioBuffer;
      console.log(`✅ Loaded sound: ${soundKey}`);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load ${soundKey}:`, error);
      return null;
    }
  }, [getAudioContext]);

  // Preload all sounds
  const preloadSounds = useCallback(async () => {
    console.log('🔊 Preloading game sounds...');
    const promises = Object.keys(SOUND_CONFIG).map(key => loadAudioBuffer(key));
    await Promise.all(promises);
    console.log('✅ All sounds preloaded');
  }, [loadAudioBuffer]);

  // Play sound effect using Web Audio API
  const playSound = useCallback(async (soundKey) => {
    if (!soundEnabled) {
      console.log(`Sound disabled, skipping: ${soundKey}`);
      return;
    }
    
    try {
      const ctx = getAudioContext();
      
      // Resume if suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      // Load buffer if not cached
      let buffer = audioBuffersRef.current[soundKey];
      if (!buffer) {
        buffer = await loadAudioBuffer(soundKey);
      }
      
      if (!buffer) {
        console.warn(`No buffer for sound: ${soundKey}`);
        return;
      }
      
      // Create source and gain nodes
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      
      source.buffer = buffer;
      
      // Set volume based on config and user settings
      const config = SOUND_CONFIG[soundKey] || { volume: 0.5 };
      gainNode.gain.value = config.volume * (effectsVolume / 100);
      
      // Connect: source -> gain -> destination
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Play
      source.start(0);
      console.log(`🔊 Playing: ${soundKey}`);
      
    } catch (error) {
      console.error(`Error playing ${soundKey}:`, error);
    }
  }, [soundEnabled, effectsVolume, getAudioContext, loadAudioBuffer]);

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
      await unlockAudio();
      
      if (!labMusicRef.current) {
        labMusicRef.current = new Audio(LAB_AMBIENT_URL);
        labMusicRef.current.loop = true;
      }
      
      labMusicRef.current.volume = (musicVolume / 100) * 0.4;
      await labMusicRef.current.play();
      setIsMusicPlaying(true);
      console.log('🎵 Lab ambient started');
      return true;
    } catch (error) {
      console.warn('Failed to start lab ambient:', error);
      return false;
    }
  }, [soundEnabled, musicVolume, unlockAudio]);

  const stopLabAmbient = useCallback(() => {
    if (labMusicRef.current) {
      labMusicRef.current.pause();
      labMusicRef.current.currentTime = 0;
      setIsMusicPlaying(false);
      console.log('🔇 Lab ambient stopped');
    }
  }, []);

  // Listen for user interaction to unlock audio
  useEffect(() => {
    const handleInteraction = async () => {
      await unlockAudio();
      preloadSounds();
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
  }, [unlockAudio, preloadSounds]);

  // Update volumes
  useEffect(() => {
    localStorage.setItem('dogefood_sound_enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('dogefood_effects_volume', effectsVolume.toString());
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = effectsVolume / 100;
    }
  }, [effectsVolume]);

  useEffect(() => {
    localStorage.setItem('dogefood_music_volume', musicVolume.toString());
    if (labMusicRef.current) {
      labMusicRef.current.volume = (musicVolume / 100) * 0.4;
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
    // Return safe defaults when not inside provider
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

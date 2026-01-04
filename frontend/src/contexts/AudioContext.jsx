import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

// Using CDN audio files that work with CORS
const AUDIO_SOURCES = {
  // Background music - ambient electronic
  background: 'https://cdn.pixabay.com/audio/2022/10/25/audio_7f3be04c9d.mp3',
  // Lab ambient - science lab atmosphere
  labAmbient: 'https://cdn.pixabay.com/audio/2022/03/15/audio_115b9c5a71.mp3',
  // UI Sounds
  click: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3',
  success: 'https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3',
  mix: 'https://cdn.pixabay.com/audio/2022/03/24/audio_6fb2c2b25b.mp3',
  collect: 'https://cdn.pixabay.com/audio/2022/03/15/audio_8cb9a90138.mp3',
  rare: 'https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3',
  levelUp: 'https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3'
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
  const backgroundMusicRef = useRef(null);
  const labAmbientRef = useRef(null);
  const effectsRef = useRef({});
  const audioContextRef = useRef(null);

  // Initialize Web Audio API context on first user interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Create audio element with error handling
  const createAudioElement = useCallback((src, loop = false, volume = 0.5) => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.loop = loop;
    audio.volume = volume;
    audio.preload = 'auto';
    
    // Handle loading errors gracefully
    audio.onerror = () => {
      console.warn(`Failed to load audio: ${src}`);
    };
    
    audio.src = src;
    return audio;
  }, []);

  // Initialize audio elements
  useEffect(() => {
    // Background music
    backgroundMusicRef.current = createAudioElement(
      AUDIO_SOURCES.background, 
      true, 
      (musicVolume / 100) * 0.4
    );
    
    // Lab ambient
    labAmbientRef.current = createAudioElement(
      AUDIO_SOURCES.labAmbient, 
      true, 
      (musicVolume / 100) * 0.2
    );
    
    // Effect sounds
    Object.entries(AUDIO_SOURCES).forEach(([key, src]) => {
      if (key !== 'background' && key !== 'labAmbient') {
        effectsRef.current[key] = createAudioElement(src, false, effectsVolume / 100);
      }
    });

    return () => {
      // Cleanup
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current = null;
      }
      if (labAmbientRef.current) {
        labAmbientRef.current.pause();
        labAmbientRef.current = null;
      }
    };
  }, [createAudioElement, musicVolume, effectsVolume]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('dogefood_sound_enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('dogefood_music_volume', musicVolume.toString());
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.volume = (musicVolume / 100) * 0.4;
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
    if (!soundEnabled) return false;
    
    initAudioContext();
    
    try {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.volume = (musicVolume / 100) * 0.4;
        await backgroundMusicRef.current.play();
        setIsMusicPlaying(true);
        console.log('🎵 Background music started');
        return true;
      }
    } catch (error) {
      console.warn('Background music play failed (user interaction required):', error.message);
      return false;
    }
    return false;
  }, [soundEnabled, musicVolume, initAudioContext]);

  // Stop background music
  const stopBackgroundMusic = useCallback(() => {
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
      setIsMusicPlaying(false);
      console.log('🔇 Background music stopped');
    }
  }, []);

  // Start lab ambient sounds
  const startLabAmbient = useCallback(async () => {
    if (!soundEnabled) return false;
    
    initAudioContext();
    
    try {
      if (labAmbientRef.current) {
        labAmbientRef.current.volume = (musicVolume / 100) * 0.2;
        await labAmbientRef.current.play();
        console.log('🧪 Lab ambient started');
        return true;
      }
    } catch (error) {
      console.warn('Lab ambient play failed:', error.message);
      return false;
    }
    return false;
  }, [soundEnabled, musicVolume, initAudioContext]);

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
    
    initAudioContext();
    
    try {
      const effect = effectsRef.current[effectName];
      if (effect) {
        // Clone the audio for overlapping sounds
        const clone = effect.cloneNode();
        clone.volume = effectsVolume / 100;
        clone.play().catch(e => {
          // Silently fail - likely user hasn't interacted yet
        });
      }
    } catch (error) {
      // Silently fail
    }
  }, [soundEnabled, effectsVolume, initAudioContext]);

  // Convenience methods
  const playClick = useCallback(() => playEffect('click'), [playEffect]);
  const playSuccess = useCallback(() => playEffect('success'), [playEffect]);
  const playMix = useCallback(() => playEffect('mix'), [playEffect]);
  const playCollect = useCallback(() => playEffect('collect'), [playEffect]);
  const playRare = useCallback(() => playEffect('rare'), [playEffect]);
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

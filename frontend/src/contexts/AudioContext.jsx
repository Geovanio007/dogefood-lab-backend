import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AudioContext = createContext(null);

// Audio sources - Only lab ambient music
const AUDIO_SOURCES = {
  // Lab ambient - sci-fi futuristic game music (custom uploaded)
  labAmbient: 'https://customer-assets.emergentagent.com/job_5412b27a-14e8-4bc6-a510-b262ffc85132/artifacts/e6xj38of_magical-technology-sci-fi-science-futuristic-game-music-300607.mp3'
};

// Fallback to base64 encoded simple sounds if URLs fail
const FALLBACK_SOUNDS = {
  click: true,
  success: true,
  mix: true,
  collect: true,
  rare: true,
  levelUp: true
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
  const isInitializedRef = useRef(false);

  // Create oscillator-based sound as fallback
  const playOscillatorSound = useCallback((type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Different frequencies for different sound types
      const frequencies = {
        click: [800, 600],
        success: [523, 659, 784],
        mix: [200, 250, 200],
        collect: [440, 554, 659],
        rare: [523, 659, 784, 1047],
        levelUp: [392, 494, 587, 784]
      };
      
      const freqs = frequencies[type] || frequencies.success;
      const duration = 0.1;
      let time = ctx.currentTime;
      
      freqs.forEach((freq, i) => {
        oscillator.frequency.setValueAtTime(freq, time + (i * duration));
      });
      
      gainNode.gain.setValueAtTime((effectsVolume / 100) * 0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (freqs.length * duration));
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + (freqs.length * duration));
    } catch (e) {
      console.log('Oscillator sound failed:', e);
    }
  }, [effectsVolume]);

  // Initialize audio elements
  const initializeAudio = useCallback(() => {
    if (isInitializedRef.current) return;
    
    console.log('🔊 Initializing audio system...');
    
    try {
      // Initialize Web Audio API context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Background music
      backgroundMusicRef.current = new Audio(AUDIO_SOURCES.background);
      backgroundMusicRef.current.loop = true;
      backgroundMusicRef.current.volume = (musicVolume / 100) * 0.4;
      backgroundMusicRef.current.preload = 'auto';
      
      // Lab ambient
      labAmbientRef.current = new Audio(AUDIO_SOURCES.labAmbient);
      labAmbientRef.current.loop = true;
      labAmbientRef.current.volume = (musicVolume / 100) * 0.3;
      labAmbientRef.current.preload = 'auto';
      
      // Effect sounds - preload all
      Object.entries(AUDIO_SOURCES).forEach(([key, src]) => {
        if (key !== 'background' && key !== 'labAmbient') {
          const audio = new Audio(src);
          audio.preload = 'auto';
          audio.volume = effectsVolume / 100;
          effectsRef.current[key] = audio;
          
          // Test load
          audio.load();
        }
      });
      
      isInitializedRef.current = true;
      console.log('✅ Audio system initialized');
    } catch (error) {
      console.error('❌ Error initializing audio:', error);
    }
  }, [musicVolume, effectsVolume]);

  // Initialize on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initializeAudio();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
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
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.volume = (musicVolume / 100) * 0.4;
    }
    if (labAmbientRef.current) {
      labAmbientRef.current.volume = (musicVolume / 100) * 0.3;
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
    
    initializeAudio();
    
    try {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.currentTime = 0;
        backgroundMusicRef.current.volume = (musicVolume / 100) * 0.4;
        await backgroundMusicRef.current.play();
        setIsMusicPlaying(true);
        console.log('🎵 Background music started');
        return true;
      }
    } catch (error) {
      console.warn('Background music play failed:', error.message);
      return false;
    }
    return false;
  }, [soundEnabled, musicVolume, initializeAudio]);

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
    
    initializeAudio();
    
    try {
      if (labAmbientRef.current) {
        labAmbientRef.current.currentTime = 0;
        labAmbientRef.current.volume = (musicVolume / 100) * 0.3;
        await labAmbientRef.current.play();
        console.log('🧪 Lab ambient started');
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
      console.log('🔇 Lab ambient stopped');
    }
  }, []);

  // Play effect sound
  const playEffect = useCallback((effectName) => {
    if (!soundEnabled) {
      console.log(`🔇 Sound disabled, skipping ${effectName}`);
      return;
    }
    
    initializeAudio();
    
    console.log(`🔊 Playing effect: ${effectName}`);
    
    try {
      const effect = effectsRef.current[effectName];
      if (effect) {
        // Create a clone for overlapping sounds
        const clone = effect.cloneNode();
        clone.volume = effectsVolume / 100;
        
        clone.play().then(() => {
          console.log(`✅ Effect ${effectName} played successfully`);
        }).catch(e => {
          console.warn(`⚠️ Effect ${effectName} failed, using fallback:`, e.message);
          // Use oscillator fallback
          playOscillatorSound(effectName);
        });
      } else {
        console.warn(`⚠️ Effect ${effectName} not found, using fallback`);
        playOscillatorSound(effectName);
      }
    } catch (error) {
      console.warn(`⚠️ Error playing ${effectName}:`, error.message);
      playOscillatorSound(effectName);
    }
  }, [soundEnabled, effectsVolume, initializeAudio, playOscillatorSound]);

  // Convenience methods
  const playClick = useCallback(() => {
    console.log('🖱️ Click sound requested');
    playEffect('click');
  }, [playEffect]);
  
  const playSuccess = useCallback(() => {
    console.log('🎉 Success sound requested');
    playEffect('success');
  }, [playEffect]);
  
  const playMix = useCallback(() => {
    console.log('🧪 Mix sound requested');
    playEffect('mix');
  }, [playEffect]);
  
  const playCollect = useCallback(() => {
    console.log('💰 Collect sound requested');
    playEffect('collect');
  }, [playEffect]);
  
  const playRare = useCallback(() => {
    console.log('✨ Rare sound requested');
    playEffect('rare');
  }, [playEffect]);
  
  const playLevelUp = useCallback(() => {
    console.log('⬆️ Level up sound requested');
    playEffect('levelUp');
  }, [playEffect]);

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
    playEffect,
    
    // Manual init (for components that need it)
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

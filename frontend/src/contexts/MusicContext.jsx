import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const MusicContext = createContext(null);

// Playlist with the provided songs (excluding lab ambient music and Tell Me What)
const PLAYLIST = [
  {
    id: 1,
    title: "Running Night",
    artist: "Electronic",
    url: "https://customer-assets.emergentagent.com/job_e7bcdee9-252d-418c-ba9f-7ff6fd76e17b/artifacts/sf4enghz_running-night-393139.mp3"
  },
  {
    id: 2,
    title: "The Last Point",
    artist: "Digital Beat",
    url: "https://customer-assets.emergentagent.com/job_e7bcdee9-252d-418c-ba9f-7ff6fd76e17b/artifacts/drtewuwr_the-last-point-beat-electronic-digital-394291.mp3"
  },
  {
    id: 3,
    title: "Deep Abstract",
    artist: "Snowcap Ambient",
    url: "https://customer-assets.emergentagent.com/job_e7bcdee9-252d-418c-ba9f-7ff6fd76e17b/artifacts/3ifm13fl_deep-abstract-ambient_snowcap-401656.mp3"
  }
];

export const MusicProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('dogefood_music_volume');
    return saved ? parseFloat(saved) : 0.2; // Default to 20% volume
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [shouldShowPlayer, setShouldShowPlayer] = useState(false);
  
  const audioRef = useRef(null);
  const hasAutoplayedRef = useRef(false);

  const currentTrack = PLAYLIST[currentTrackIndex];

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.preload = 'auto';
      
      // Event listeners
      audioRef.current.addEventListener('ended', handleTrackEnd);
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current.duration);
      });
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current.currentTime);
      });
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleTrackEnd);
        audioRef.current.pause();
      }
    };
  }, []);

  // Load track when index changes
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      const wasPlaying = isPlaying;
      audioRef.current.src = currentTrack.url;
      audioRef.current.load();
      if (wasPlaying) {
        audioRef.current.play().catch(console.error);
      }
    }
  }, [currentTrackIndex]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    localStorage.setItem('dogefood_music_volume', volume.toString());
  }, [volume]);

  // Handle track end - play next
  const handleTrackEnd = useCallback(() => {
    setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length);
  }, []);

  // Attempt autoplay after user interaction
  const attemptAutoplay = useCallback(async () => {
    if (hasAutoplayedRef.current || !audioRef.current) return;
    
    try {
      audioRef.current.src = currentTrack.url;
      await audioRef.current.play();
      setIsPlaying(true);
      hasAutoplayedRef.current = true;
      console.log('🎵 Music autoplay started');
    } catch (error) {
      console.log('Autoplay blocked, waiting for user interaction');
    }
  }, [currentTrack]);

  // Listen for first user interaction to enable autoplay
  useEffect(() => {
    const handleFirstInteraction = async () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
        if (shouldShowPlayer && !hasAutoplayedRef.current) {
          await attemptAutoplay();
        }
      }
    };

    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, handleFirstInteraction, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleFirstInteraction);
      });
    };
  }, [hasUserInteracted, shouldShowPlayer, attemptAutoplay]);

  // Play/Pause toggle
  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Play error:', error);
    }
  }, [isPlaying]);

  // Next track
  const nextTrack = useCallback(() => {
    setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length);
  }, []);

  // Previous track
  const prevTrack = useCallback(() => {
    setCurrentTrackIndex((prev) => (prev - 1 + PLAYLIST.length) % PLAYLIST.length);
  }, []);

  // Seek to position
  const seekTo = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Show player on specific pages
  const showPlayer = useCallback(() => {
    setShouldShowPlayer(true);
    if (hasUserInteracted && !hasAutoplayedRef.current) {
      attemptAutoplay();
    }
  }, [hasUserInteracted, attemptAutoplay]);

  // Hide player
  const hidePlayer = useCallback(() => {
    setShouldShowPlayer(false);
  }, []);

  // Stop music completely
  const stopMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const value = {
    isPlaying,
    currentTrack,
    currentTrackIndex,
    playlist: PLAYLIST,
    volume,
    isMinimized,
    duration,
    currentTime,
    shouldShowPlayer,
    
    setVolume,
    setIsMinimized,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    showPlayer,
    hidePlayer,
    stopMusic
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    return {
      isPlaying: false,
      currentTrack: null,
      playlist: [],
      volume: 0.5,
      isMinimized: false,
      duration: 0,
      currentTime: 0,
      shouldShowPlayer: false,
      setVolume: () => {},
      setIsMinimized: () => {},
      togglePlay: () => {},
      nextTrack: () => {},
      prevTrack: () => {},
      seekTo: () => {},
      showPlayer: () => {},
      hidePlayer: () => {},
      stopMusic: () => {}
    };
  }
  return context;
};

export default MusicContext;

import React, { useEffect } from 'react';
import { useMusic } from '../contexts/MusicContext';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Minimize2, Maximize2, Music } from 'lucide-react';

const MusicPlayer = () => {
  const {
    isPlaying,
    currentTrack,
    currentTrackIndex,
    playlist,
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
    showPlayer
  } = useMusic();

  // Show player when component mounts
  useEffect(() => {
    showPlayer();
  }, [showPlayer]);

  if (!shouldShowPlayer) return null;

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Minimized view - floating button
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg flex items-center justify-center hover:scale-110 transition-transform border-2 border-white/20"
        data-testid="music-player-expand"
      >
        {isPlaying ? (
          <div className="flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-0.5" />
            <div className="w-2 h-3 bg-white rounded-full animate-pulse delay-75 mr-0.5" />
            <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-150" />
          </div>
        ) : (
          <Music className="w-5 h-5 text-white" />
        )}
      </button>
    );
  }

  // Full player view
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 w-72 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      data-testid="music-player"
    >
      {/* Header with minimize */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Music className="w-3 h-3 text-white" />
          </div>
          <span className="text-white text-xs font-semibold">Now Playing</span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 hover:bg-white/10 rounded-full transition-colors"
          data-testid="music-player-minimize"
        >
          <Minimize2 className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Track info */}
      <div className="px-3 py-2">
        <div className="text-white text-sm font-semibold truncate">
          {currentTrack?.title || 'No Track'}
        </div>
        <div className="text-white/60 text-xs truncate">
          {currentTrack?.artist || 'Unknown Artist'}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-3 pb-1">
        <div 
          className="relative h-1 bg-white/20 rounded-full cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            seekTo(percent * duration);
          }}
        >
          <div 
            className="absolute h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
          <div 
            className="absolute h-3 w-3 bg-white rounded-full -top-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/50 mt-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-3 py-2">
        <button
          onClick={prevTrack}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          data-testid="music-prev"
        >
          <SkipBack className="w-4 h-4 text-white" />
        </button>
        
        <button
          onClick={togglePlay}
          className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full hover:scale-105 transition-transform shadow-lg"
          data-testid="music-play-pause"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>
        
        <button
          onClick={nextTrack}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          data-testid="music-next"
        >
          <SkipForward className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <button
          onClick={() => setVolume(volume > 0 ? 0 : 0.5)}
          className="p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          {volume === 0 ? (
            <VolumeX className="w-3 h-3 text-white/60" />
          ) : (
            <Volume2 className="w-3 h-3 text-white/60" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
        />
      </div>

      {/* Playlist indicator */}
      <div className="px-3 pb-2">
        <div className="flex items-center justify-center gap-1">
          {playlist.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                index === currentTrackIndex 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
        <div className="text-center text-[9px] text-white/40 mt-0.5">
          Track {currentTrackIndex + 1} of {playlist.length}
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;

import React from 'react';
import { useMusic } from '../contexts/MusicContext';
import { Volume2, VolumeX, SkipForward, SkipBack, Play, Pause, Music } from 'lucide-react';

const MusicPlayer = () => {
  const { 
    isPlaying, 
    togglePlay, 
    volume, 
    setVolume, 
    currentTrack, 
    currentTrackIndex,
    nextTrack, 
    prevTrack, 
    playlist
  } = useMusic();

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    localStorage.setItem('dogefood_music_volume', newVolume.toString());
  };

  const isMuted = volume === 0;

  return (
    <div data-testid="music-player" className="relative overflow-hidden">
      <div className="bg-slate-900/90 backdrop-blur-md border border-sky-400/20 rounded-xl p-3 shadow-lg">
        
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-yellow-400 via-sky-400 to-yellow-400" />
        
        {/* Track info row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400/20 to-sky-400/20 flex items-center justify-center flex-shrink-0 border border-sky-400/20">
            <Music className="w-4 h-4 text-sky-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {currentTrack?.title || 'No Track'}
            </div>
            <div className="text-[10px] text-sky-300/70">
              {currentTrack?.artist || ''} {playlist.length > 0 ? `- Track ${currentTrackIndex + 1}/${playlist.length}` : ''}
            </div>
          </div>
          {isPlaying && (
            <div className="flex items-end gap-[2px] h-3">
              <div className="w-[2px] bg-yellow-400 rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms', animationDuration: '600ms' }} />
              <div className="w-[2px] bg-sky-400 rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms', animationDuration: '600ms' }} />
              <div className="w-[2px] bg-yellow-400 rounded-full animate-bounce" style={{ height: '40%', animationDelay: '300ms', animationDuration: '600ms' }} />
              <div className="w-[2px] bg-sky-400 rounded-full animate-bounce" style={{ height: '80%', animationDelay: '450ms', animationDuration: '600ms' }} />
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              data-testid="music-prev-btn"
              onClick={prevTrack}
              className="w-7 h-7 rounded-md flex items-center justify-center text-sky-300 hover:text-white hover:bg-sky-400/20 transition-all"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              data-testid="music-play-btn"
              onClick={togglePlay}
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-yellow-400 to-yellow-500 text-slate-900 hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-md shadow-yellow-500/20"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              data-testid="music-next-btn"
              onClick={nextTrack}
              className="w-7 h-7 rounded-md flex items-center justify-center text-sky-300 hover:text-white hover:bg-sky-400/20 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              data-testid="music-mute-btn"
              onClick={() => setVolume(isMuted ? 0.1 : 0)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-sky-300 hover:text-white hover:bg-sky-400/20 transition-all"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <div className="relative w-16 h-7 flex items-center">
              <input
                data-testid="music-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #38bdf8 0%, #facc15 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 0 4px rgba(250, 204, 21, 0.5);
        }
        input[type="range"]::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 4px rgba(250, 204, 21, 0.5);
        }
      `}</style>
    </div>
  );
};

export default MusicPlayer;

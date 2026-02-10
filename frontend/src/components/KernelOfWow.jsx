import React, { useState, useEffect } from 'react';
import { Sparkles, Clock, Zap, Star, Crown, AlertCircle, Gem } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Kernel of Wow Icon Component
const KernelIcon = ({ className = "w-6 h-6" }) => (
  <div className={`${className} bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg`}>
    <Gem className="w-4 h-4 text-white" />
  </div>
);

// Format time remaining
const formatTimeRemaining = (seconds) => {
  if (seconds <= 0) return 'Expired';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Global Kernel of Wow Banner (shows current holder to everyone)
export const KernelOfWowBanner = ({ currentHolder, onClose }) => {
  if (!currentHolder || !currentHolder.has_holder) return null;
  
  const holder = currentHolder.holder;
  const displayName = holder?.player_nickname || 
    `${holder?.player_address?.slice(0, 6)}...${holder?.player_address?.slice(-4)}`;
  
  return (
    <div className="bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border-b border-yellow-500/30 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm">
        <KernelIcon className="w-6 h-6 animate-pulse" />
        <span className="text-yellow-200">
          <span className="font-bold text-yellow-400">Kernel of Wow</span> is with{' '}
          <span className="font-bold text-white">{displayName}</span>
        </span>
        <span className="text-yellow-400/60">|</span>
        <span className="text-yellow-300/80">
          {formatTimeRemaining(currentHolder.time_remaining_seconds)} remaining
        </span>
      </div>
    </div>
  );
};

// Player's Kernel of Wow Status (shows in Lab if player has it)
export const KernelOfWowStatus = ({ playerAddress, onStatusChange }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!playerAddress) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/special-ingredient/check/${playerAddress}`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
          setTimeRemaining(data.time_remaining_seconds || 0);
          if (onStatusChange) onStatusChange(data.has_ingredient);
        }
      } catch (err) {
        console.error('Error fetching kernel status:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [playerAddress, onStatusChange]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining]);

  if (loading || !status?.has_ingredient) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-yellow-400/50 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-orange-500/20 p-4 mb-4">
      {/* Animated glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-pulse" />
      
      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-xl animate-pulse" />
          <img 
            src={KERNEL_ICON} 
            alt="Kernel of Wow" 
            className="w-16 h-16 relative z-10 drop-shadow-lg animate-bounce"
            style={{ animationDuration: '2s' }}
          />
        </div>
        
        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-yellow-400">Kernel of Wow Active!</h3>
            <Sparkles className="w-5 h-5 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <p className="text-sm text-yellow-200/80 mb-2">
            Your treats get bonus points! Choose combos wisely for up to +30% boost!
          </p>
          
          {/* Timer */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-mono font-bold">
                {formatTimeRemaining(timeRemaining)}
              </span>
              <span className="text-yellow-300/60">remaining</span>
            </div>
            
            {/* Usage stats */}
            <div className="flex items-center gap-1.5 text-sm">
              <Zap className="w-4 h-4 text-sky-400" />
              <span className="text-sky-400">{status.used_count || 0} treats boosted</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bonus tiers hint */}
      <div className="mt-4 pt-3 border-t border-yellow-400/20">
        <div className="text-xs text-yellow-300/70 mb-2">Bonus Tiers:</div>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs border border-green-500/30">
            +5% Common
          </span>
          <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs border border-blue-500/30">
            +15% Rare
          </span>
          <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs border border-purple-500/30">
            +20% Epic
          </span>
          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs border border-amber-500/30">
            +30% Legendary
          </span>
        </div>
      </div>
    </div>
  );
};

// Kernel of Wow Ingredient Card (for Lab ingredient selection)
export const KernelIngredientCard = ({ isSelected, onSelect, disabled }) => {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`
        relative overflow-hidden rounded-xl border-2 p-3 transition-all duration-300
        ${isSelected 
          ? 'border-yellow-400 bg-gradient-to-br from-yellow-500/30 to-amber-500/20 scale-105 shadow-lg shadow-yellow-500/30' 
          : 'border-yellow-400/30 bg-gradient-to-br from-yellow-500/10 to-amber-500/5 hover:border-yellow-400/60 hover:scale-102'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Glow effect when selected */}
      {isSelected && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent animate-pulse" />
      )}
      
      <div className="relative flex flex-col items-center gap-2">
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-lg" />
          <img 
            src={KERNEL_ICON} 
            alt="Kernel of Wow" 
            className={`w-12 h-12 relative z-10 ${isSelected ? 'animate-bounce' : ''}`}
            style={{ animationDuration: '1.5s' }}
          />
        </div>
        
        <div className="text-center">
          <div className="text-xs font-bold text-yellow-400">Kernel of Wow</div>
          <div className="text-[10px] text-yellow-300/60">Special</div>
        </div>
        
        {/* Bonus indicator */}
        <div className="absolute top-1 right-1">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
        </div>
      </div>
    </button>
  );
};

// Kernel Bonus Result Display (shows after treat creation)
export const KernelBonusResult = ({ bonusInfo }) => {
  if (!bonusInfo) return null;
  
  const tierColors = {
    legendary: 'from-amber-400 to-yellow-500',
    epic: 'from-purple-400 to-pink-500',
    rare: 'from-blue-400 to-cyan-500',
    common: 'from-green-400 to-emerald-500'
  };
  
  const tierIcons = {
    legendary: Crown,
    epic: Star,
    rare: Zap,
    common: Sparkles
  };
  
  const TierIcon = tierIcons[bonusInfo.tier] || Sparkles;
  
  return (
    <div className={`
      relative overflow-hidden rounded-xl border-2 p-4
      ${bonusInfo.tier === 'legendary' ? 'border-amber-400 animate-pulse' : 
        bonusInfo.tier === 'epic' ? 'border-purple-400' :
        bonusInfo.tier === 'rare' ? 'border-blue-400' : 'border-green-400'}
      bg-gradient-to-br ${tierColors[bonusInfo.tier] || tierColors.common} bg-opacity-20
    `}>
      <div className="relative flex items-center gap-4">
        <div className="relative">
          <KernelIcon className="w-12 h-12" />
          <TierIcon className="absolute -bottom-1 -right-1 w-5 h-5 text-white drop-shadow-lg" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-lg font-bold bg-gradient-to-r ${tierColors[bonusInfo.tier]} bg-clip-text text-transparent`}>
              {bonusInfo.tier.toUpperCase()} COMBO!
            </span>
          </div>
          <p className="text-sm text-white/80">{bonusInfo.description}</p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-white">+{bonusInfo.bonus_percent}%</div>
          <div className="text-xs text-white/60">
            +{bonusInfo.points_bonus} pts / +{bonusInfo.xp_bonus} xp
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook to fetch current kernel holder
export const useKernelOfWow = () => {
  const [currentHolder, setCurrentHolder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHolder = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/special-ingredient/current`);
        if (response.ok) {
          const data = await response.json();
          setCurrentHolder(data);
        }
      } catch (err) {
        console.error('Error fetching kernel holder:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHolder();
    const interval = setInterval(fetchHolder, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return { currentHolder, loading };
};

export default {
  KernelOfWowBanner,
  KernelOfWowStatus,
  KernelIngredientCard,
  KernelBonusResult,
  useKernelOfWow
};

import React, { useState, useEffect } from 'react';
import { Clock, Zap, Crown, AlertCircle, Gem } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const KernelIcon = ({ className = "w-6 h-6" }) => (
  <div className={`${className} bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center`}>
    <Gem className="w-4 h-4 text-white" />
  </div>
);

const formatTimeRemaining = (seconds) => {
  if (seconds <= 0) return 'Expired';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const KernelOfWowBanner = ({ currentHolder, onClose }) => {
  if (!currentHolder || !currentHolder.has_holder) return null;
  const holder = currentHolder.holder;
  const displayName = holder?.player_nickname ||
    `${holder?.player_address?.slice(0, 6)}...${holder?.player_address?.slice(-4)}`;

  return (
    <div className="bg-slate-800/80 border-b border-amber-500/30 px-4 py-2.5" data-testid="kernel-wow-banner">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm">
        <KernelIcon className="w-6 h-6" />
        <span className="text-slate-300">
          <span className="font-bold text-amber-400">Kernel of Wow</span> held by{' '}
          <span className="font-semibold text-white">{displayName}</span>
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400 font-mono text-xs">
          {formatTimeRemaining(currentHolder.time_remaining_seconds)} left
        </span>
      </div>
    </div>
  );
};

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
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [playerAddress, onStatusChange]);

  useEffect(() => {
    if (timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining]);

  if (loading || !status?.has_ingredient) return null;

  return (
    <div
      className="mb-6 rounded-xl border border-amber-500/40 bg-slate-800/90 overflow-hidden"
      data-testid="kernel-wow-status"
    >
      {/* Header bar */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-5 py-3 border-b border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
            <Gem className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Kernel of Wow Active</h3>
            <p className="text-amber-300/80 text-xs">Bonus points on all treats</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-white font-mono font-bold text-base">
              {formatTimeRemaining(timeRemaining)}
            </span>
          </div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider">remaining</div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-slate-300 text-xs mb-3">
          Choose combos wisely for up to +30% boost on treats created while holding the Kernel.
        </p>

        {/* Usage stat */}
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-sky-300 text-xs font-medium">{status.used_count || 0} treats boosted</span>
        </div>

        {/* Bonus tiers */}
        <div className="border-t border-slate-700/60 pt-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Bonus Tiers</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded bg-green-500/15 text-green-400 text-[11px] font-medium border border-green-500/20">
              +5% Common
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[11px] font-medium border border-blue-500/20">
              +15% Rare
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 text-[11px] font-medium border border-purple-500/20">
              +20% Epic
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[11px] font-medium border border-amber-500/20">
              +30% Legendary
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const KernelIngredientCard = ({ isSelected, onSelect, disabled }) => {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      data-testid="kernel-ingredient-card"
      className={`
        relative overflow-hidden rounded-xl border-2 p-3 transition-all duration-200
        ${isSelected
          ? 'border-amber-400 bg-amber-500/15 scale-105 shadow-lg shadow-amber-500/20'
          : 'border-slate-600 bg-slate-800/60 hover:border-amber-400/50 hover:bg-amber-500/5'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
          <Gem className="w-7 h-7 text-white" />
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-amber-400">Kernel of Wow</div>
          <div className="text-[10px] text-slate-500">Special</div>
        </div>
      </div>
    </button>
  );
};

export const KernelBonusResult = ({ bonusInfo }) => {
  if (!bonusInfo) return null;

  const tierConfig = {
    legendary: { gradient: 'from-amber-500/20 to-yellow-500/20', border: 'border-amber-500/50', text: 'text-amber-400', Icon: Crown },
    epic: { gradient: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/50', text: 'text-purple-400', Icon: Gem },
    rare: { gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/50', text: 'text-blue-400', Icon: Zap },
    common: { gradient: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/50', text: 'text-green-400', Icon: Zap }
  };

  const config = tierConfig[bonusInfo.tier] || tierConfig.common;
  const TierIcon = config.Icon;

  return (
    <div
      className={`rounded-xl border ${config.border} bg-gradient-to-r ${config.gradient} bg-slate-800/80 p-4`}
      data-testid="kernel-bonus-result"
    >
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <KernelIcon className="w-12 h-12" />
          <TierIcon className="absolute -bottom-1 -right-1 w-4 h-4 text-white drop-shadow" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-base font-bold ${config.text}`}>
            {bonusInfo.tier.toUpperCase()} COMBO
          </div>
          <p className="text-sm text-slate-300 truncate">{bonusInfo.description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-white">+{bonusInfo.bonus_percent}%</div>
          <div className="text-[10px] text-slate-500">
            +{bonusInfo.points_bonus} pts / +{bonusInfo.xp_bonus} xp
          </div>
        </div>
      </div>
    </div>
  );
};

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
    const interval = setInterval(fetchHolder, 30000);
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

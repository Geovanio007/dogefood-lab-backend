import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Crown, Sparkles, Wallet, Filter, Grid3X3, List, Trophy, Beaker, Coins, ChevronDown } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useTelegram } from '../contexts/TelegramContext';
import TreatIcon from './TreatIcon';
import MusicPlayer from './MusicPlayer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Glass Treat Card Component
const TreatCard = ({ treat, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getRarityConfig = (rarity) => {
    switch (rarity?.toLowerCase()) {
      case 'legendary':
        return {
          gradient: 'from-amber-400 via-yellow-300 to-amber-500',
          glow: 'shadow-amber-400/30',
          border: 'border-amber-400/50',
          bg: 'from-amber-500/10 to-yellow-500/5',
          text: 'text-amber-400',
          icon: '💎',
          shine: 'bg-gradient-to-r from-transparent via-amber-200/30 to-transparent'
        };
      case 'epic':
        return {
          gradient: 'from-purple-400 via-pink-400 to-purple-500',
          glow: 'shadow-purple-400/30',
          border: 'border-purple-400/50',
          bg: 'from-purple-500/10 to-pink-500/5',
          text: 'text-purple-400',
          icon: '⭐',
          shine: 'bg-gradient-to-r from-transparent via-purple-200/30 to-transparent'
        };
      case 'rare':
        return {
          gradient: 'from-blue-400 via-cyan-400 to-blue-500',
          glow: 'shadow-blue-400/30',
          border: 'border-blue-400/50',
          bg: 'from-blue-500/10 to-cyan-500/5',
          text: 'text-blue-400',
          icon: '✨',
          shine: 'bg-gradient-to-r from-transparent via-blue-200/30 to-transparent'
        };
      default:
        return {
          gradient: 'from-green-400 via-emerald-400 to-green-500',
          glow: 'shadow-green-400/20',
          border: 'border-green-400/30',
          bg: 'from-green-500/10 to-emerald-500/5',
          text: 'text-green-400',
          icon: '🍪',
          shine: 'bg-gradient-to-r from-transparent via-green-200/20 to-transparent'
        };
    }
  };
  
  const config = getRarityConfig(treat.rarity);
  
  return (
    <div
      className={`
        relative group cursor-pointer
        transform transition-all duration-500 ease-out
        ${isHovered ? 'scale-[1.02] -translate-y-1' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Glow Effect */}
      <div className={`
        absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500
        bg-gradient-to-r ${config.gradient} blur-xl
      `} />
      
      {/* Card */}
      <div className={`
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br ${config.bg}
        backdrop-blur-xl border ${config.border}
        ${isHovered ? `shadow-2xl ${config.glow}` : 'shadow-lg'}
        transition-all duration-500
      `}>
        {/* Shine Effect */}
        <div className={`
          absolute inset-0 ${config.shine}
          transform -skew-x-12 -translate-x-full group-hover:translate-x-full
          transition-transform duration-1000 ease-out
        `} />
        
        {/* Glass Overlay */}
        <div className="absolute inset-0 bg-white/5" />
        
        {/* Content */}
        <div className="relative p-4">
          {/* Rarity Badge */}
          <div className="flex justify-between items-start mb-3">
            <Badge className={`
              bg-gradient-to-r ${config.gradient} text-white font-bold
              px-3 py-1 rounded-full text-xs shadow-lg
            `}>
              {config.icon} {treat.rarity || 'Common'}
            </Badge>
            {treat.season_id && (
              <Badge className="bg-slate-800/80 text-slate-300 border border-slate-600/50 text-xs">
                S{treat.season_id}
              </Badge>
            )}
          </div>
          
          {/* Treat Image */}
          <div className="relative w-full aspect-square mb-4 flex items-center justify-center">
            <div className={`
              absolute inset-0 rounded-xl bg-gradient-to-br ${config.bg}
              opacity-50
            `} />
            <img 
              src={treat.image || "https://customer-assets.emergentagent.com/job_shibalab/artifacts/l9ufequf_20250720_2152_Shiba_Pouring_Cereal_remix_01k0mp753tfzxs9v4dqxhtp2ng-removebg-preview.png"}
              alt={treat.name || 'DogeFood Treat'}
              className="relative w-20 h-20 object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500"
              onError={(e) => {
                e.target.src = "https://customer-assets.emergentagent.com/job_shibalab/artifacts/l9ufequf_20250720_2152_Shiba_Pouring_Cereal_remix_01k0mp753tfzxs9v4dqxhtp2ng-removebg-preview.png";
              }}
            />
          </div>
          
          {/* Treat Info */}
          <div className="text-center">
            <h3 className="font-bold text-white text-lg mb-1 truncate">
              {treat.name || 'Mysterious Treat'}
            </h3>
            
            {/* Stats Row */}
            <div className="flex justify-center gap-4 mt-3">
              <div className="text-center">
                <div className={`text-lg font-bold ${config.text}`}>
                  {treat.points || 0}
                </div>
                <div className="text-xs text-slate-400">Points</div>
              </div>
              <div className="w-px bg-slate-600/50" />
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {treat.xp || 0}
                </div>
                <div className="text-xs text-slate-400">XP</div>
              </div>
            </div>
          </div>
          
          {/* Ingredients */}
          {treat.ingredients && treat.ingredients.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex justify-center gap-1 flex-wrap">
                {treat.ingredients.slice(0, 4).map((ing, i) => (
                  <span key={i} className="text-sm opacity-80">{ing}</span>
                ))}
                {treat.ingredients.length > 4 && (
                  <span className="text-xs text-slate-400">+{treat.ingredients.length - 4}</span>
                )}
              </div>
            </div>
          )}
          
          {/* Creation Date */}
          {treat.created_at && (
            <div className="mt-2 text-center">
              <span className="text-xs text-slate-500">
                {new Date(treat.created_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Stats Card Component
const StatsCard = ({ icon: Icon, value, label, color = 'green', subtext }) => (
  <div className={`
    relative overflow-hidden rounded-2xl
    bg-gradient-to-br from-slate-800/80 to-slate-900/80
    backdrop-blur-xl border border-slate-700/50
    p-4 sm:p-5 transition-all duration-300 hover:border-${color}-500/50
    group
  `}>
    {/* Subtle Glow */}
    <div className={`absolute inset-0 bg-${color}-500/5 opacity-0 group-hover:opacity-100 transition-opacity`} />
    
    <div className="relative flex items-start gap-3">
      <div className={`
        w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center
        bg-${color}-500/20 text-${color}-400
      `}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-2xl sm:text-3xl font-bold text-${color}-400`}>
          {value}
        </div>
        <div className="text-xs sm:text-sm text-slate-400">{label}</div>
        {subtext && (
          <div className="text-xs text-slate-500 mt-1">{subtext}</div>
        )}
      </div>
    </div>
  </div>
);

const MyTreats = () => {
  const { isConnected, address } = useAccount();
  const { isTelegram, telegramUser } = useTelegram();
  const { user, points: contextPoints, currentLevel, isNFTHolder, loadPlayerData, dispatch } = useGame();
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [treats, setTreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerNFTStatus, setPlayerNFTStatus] = useState(false);
  const [playerPoints, setPlayerPoints] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  
  // Get effective player address
  const getEffectiveAddress = () => {
    if (address) return address;
    if (isTelegram && telegramUser?.id) return `TG_${telegramUser.id}`;
    const storedPlayer = localStorage.getItem('dogefood_player');
    if (storedPlayer) {
      try {
        const player = JSON.parse(storedPlayer);
        return player.guest_id || player.id || player.address;
      } catch (e) {}
    }
    return null;
  };
  
  const effectiveAddress = getEffectiveAddress();
  
  // Fetch treats and player data
  useEffect(() => {
    const fetchData = async () => {
      if (!effectiveAddress) {
        setTreats([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        const [playerResponse, treatsResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/api/player/${effectiveAddress}`),
          fetch(`${BACKEND_URL}/api/treats/${effectiveAddress}`)
        ]);
        
        if (playerResponse.ok) {
          const playerData = await playerResponse.json();
          setPlayerNFTStatus(playerData.is_nft_holder === true);
          setPlayerPoints(playerData.points || 0);
          setPlayerLevel(playerData.level || 1);
          if (dispatch) {
            dispatch({ type: 'SET_NFT_HOLDER', payload: playerData.is_nft_holder === true });
            dispatch({ type: 'LOAD_PLAYER_DATA', payload: {
              level: playerData.level || 1,
              experience: playerData.experience || 0,
              points: playerData.points || 0
            }});
          }
        }
        
        if (treatsResponse.ok) {
          const data = await treatsResponse.json();
          setTreats(Array.isArray(data) ? data : data.treats || []);
        } else {
          setTreats([]);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load treats');
        setTreats([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [effectiveAddress, dispatch]);
  
  const effectiveNFTStatus = playerNFTStatus || isNFTHolder;
  const effectivePoints = playerPoints || contextPoints || 0;
  
  const filteredTreats = treats.filter(treat => 
    selectedRarity === 'all' || treat.rarity?.toLowerCase() === selectedRarity.toLowerCase()
  );

  const rarityStats = {
    legendary: treats.filter(t => t.rarity?.toLowerCase() === 'legendary').length,
    epic: treats.filter(t => t.rarity?.toLowerCase() === 'epic').length,
    rare: treats.filter(t => t.rarity?.toLowerCase() === 'rare').length,
    common: treats.filter(t => !t.rarity || t.rarity?.toLowerCase() === 'common').length,
  };

  const rarities = [
    { id: 'all', label: 'All', count: treats.length },
    { id: 'legendary', label: 'Legendary', count: rarityStats.legendary, color: 'amber' },
    { id: 'epic', label: 'Epic', count: rarityStats.epic, color: 'purple' },
    { id: 'rare', label: 'Rare', count: rarityStats.rare, color: 'blue' },
    { id: 'common', label: 'Common', count: rarityStats.common, color: 'green' },
  ];

  return (
    <div className="min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent" />
      
      <div className="relative z-10 p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">Back</span>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                <TreatIcon size="lg" />
                My Treats
              </h1>
              <p className="text-sm text-slate-400 hidden sm:block">Your collection of magical Dogetreats</p>
            </div>
          </div>
          
          {effectiveNFTStatus && (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-4 py-2 rounded-full">
              <Crown className="w-4 h-4 mr-2" />
              VIP Scientist
            </Badge>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatsCard 
            icon={Beaker} 
            value={treats.length} 
            label="Total Treats" 
            color="amber"
          />
          <StatsCard 
            icon={Sparkles} 
            value={effectiveNFTStatus ? '1+' : '0'} 
            label="DogeFood NFTs" 
            color="purple"
          />
          <StatsCard 
            icon={Trophy} 
            value={effectivePoints.toLocaleString()} 
            label="Total Points"
            color="green"
            subtext="Season End: Convert to $LAB"
          />
          <StatsCard 
            icon={Coins} 
            value="0.00" 
            label="$LAB Tokens" 
            color="blue"
          />
        </div>

        {/* Wallet Info - Only for connected wallets */}
        {isConnected && address && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-800/50 backdrop-blur border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-400">Connected Wallet</div>
                <div className="text-sm text-white font-mono truncate">{address}</div>
              </div>
              <Badge className={effectiveNFTStatus ? "bg-purple-500/20 text-purple-400 border-purple-500/50" : "bg-slate-700 text-slate-400"}>
                {effectiveNFTStatus ? "NFT Holder" : "No NFT"}
              </Badge>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors sm:hidden"
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm">Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Desktop Filters */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              {rarities.map(rarity => (
                <button
                  key={rarity.id}
                  onClick={() => setSelectedRarity(rarity.id)}
                  className={`
                    px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                    ${selectedRarity === rarity.id 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg' 
                      : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 border border-slate-700/50'}
                  `}
                >
                  {rarity.label}
                  {rarity.count > 0 && (
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      selectedRarity === rarity.id ? 'bg-white/20' : 'bg-slate-700'
                    }`}>
                      {rarity.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700/50">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Mobile Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 sm:hidden">
              {rarities.map(rarity => (
                <button
                  key={rarity.id}
                  onClick={() => setSelectedRarity(rarity.id)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${selectedRarity === rarity.id 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' 
                      : 'bg-slate-800/60 text-slate-300 border border-slate-700/50'}
                  `}
                >
                  {rarity.label} ({rarity.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mb-4" />
            <p className="text-slate-400">Loading your treats...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-4xl">❌</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Error loading treats</h3>
            <p className="text-slate-400 mb-6">{error}</p>
            <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              Try Again
            </Button>
          </div>
        ) : filteredTreats.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
              <span className="text-5xl">🥺</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {treats.length === 0 ? "No treats yet!" : "No treats match your filter"}
            </h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              {treats.length === 0 
                ? "Head to the Lab and start creating some magical Dogetreats!" 
                : "Try adjusting your filters to see more treats."}
            </p>
            {treats.length === 0 && (
              <Link to="/lab">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold">
                  <Beaker className="w-4 h-4 mr-2" />
                  Start Creating Treats
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className={`
            ${viewMode === 'grid' 
              ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' 
              : 'flex flex-col gap-3'}
          `}>
            {filteredTreats.map((treat, index) => (
              <TreatCard key={treat.id || index} treat={treat} index={index} />
            ))}
          </div>
        )}
        
        {/* Results Count */}
        {!loading && filteredTreats.length > 0 && (
          <div className="text-center mt-8 text-slate-500 text-sm">
            Showing {filteredTreats.length} of {treats.length} treats
          </div>
        )}
      </div>
      
      {/* Music Player */}
      <MusicPlayer />
    </div>
  );
};

export default MyTreats;

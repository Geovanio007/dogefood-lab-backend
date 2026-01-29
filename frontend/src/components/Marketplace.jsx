import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useTelegram } from '../contexts/TelegramContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { 
  ArrowLeft, 
  Store, 
  Filter, 
  Search, 
  Tag, 
  TrendingUp, 
  ChevronDown,
  X,
  Sparkles,
  Clock,
  ShoppingCart,
  AlertCircle,
  Loader2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Rarity configurations matching the game theme
const RARITY_CONFIG = {
  mythic: { gradient: 'from-rose-400 to-pink-500', text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-400/50' },
  legendary: { gradient: 'from-amber-400 to-yellow-500', text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-400/50' },
  epic: { gradient: 'from-purple-400 to-pink-500', text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-400/50' },
  rare: { gradient: 'from-blue-400 to-cyan-500', text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-400/50' },
  uncommon: { gradient: 'from-cyan-400 to-teal-500', text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-400/50' },
  common: { gradient: 'from-green-400 to-emerald-500', text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-400/50' }
};

const getRarityConfig = (rarity) => {
  return RARITY_CONFIG[rarity?.toLowerCase()] || RARITY_CONFIG.common;
};

// Marketplace Listing Card Component
const ListingCard = ({ listing, ingredientMap, onBuy }) => {
  const config = getRarityConfig(listing.treat_rarity);
  
  const getIngredientName = (ing) => {
    if (ing && ing.startsWith('ING')) {
      return ingredientMap[ing] || ing;
    }
    return ing;
  };

  return (
    <div className={`
      relative overflow-hidden rounded-xl border ${config.border}
      bg-gradient-to-br from-slate-900/90 to-slate-800/90
      backdrop-blur-sm transition-all duration-300
      hover:scale-[1.02] hover:shadow-lg hover:shadow-sky-400/20
    `}>
      {/* Rarity Badge */}
      <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} border ${config.border}`}>
        {listing.treat_rarity}
      </div>
      
      {/* Image */}
      <div className="relative h-32 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
        {listing.treat_image ? (
          <img 
            src={listing.treat_image} 
            alt={listing.treat_name}
            className="w-24 h-24 object-contain drop-shadow-lg"
          />
        ) : (
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${config.gradient} opacity-50`} />
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Name */}
        <h3 className={`font-bold text-sm truncate ${config.text}`}>
          {listing.treat_name}
        </h3>
        
        {/* Stats */}
        <div className="flex justify-between text-xs">
          <div className="text-center">
            <div className="text-yellow-400 font-bold">{listing.treat_points_reward || 0}</div>
            <div className="text-slate-400">Points</div>
          </div>
          <div className="text-center">
            <div className="text-sky-400 font-bold">{listing.treat_xp_reward || 0}</div>
            <div className="text-slate-400">XP</div>
          </div>
        </div>
        
        {/* Ingredients */}
        {listing.treat_ingredients && listing.treat_ingredients.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <div className="flex flex-wrap gap-1">
              {listing.treat_ingredients.slice(0, 3).map((ing, i) => (
                <span key={i} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-300">
                  {getIngredientName(ing)}
                </span>
              ))}
              {listing.treat_ingredients.length > 3 && (
                <span className="text-[10px] text-slate-500">+{listing.treat_ingredients.length - 3}</span>
              )}
            </div>
          </div>
        )}
        
        {/* Prices */}
        <div className="pt-2 border-t border-white/10 space-y-1">
          {listing.price_doge && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">DOGE</span>
              <span className="font-bold text-yellow-400">{listing.price_doge.toLocaleString()}</span>
            </div>
          )}
          {listing.price_lab && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">$LAB</span>
              <span className="font-bold text-sky-400">{listing.price_lab.toLocaleString()}</span>
            </div>
          )}
        </div>
        
        {/* Seller */}
        <div className="text-xs text-slate-500 truncate">
          by {listing.seller_nickname || `${listing.seller_address?.slice(0, 6)}...${listing.seller_address?.slice(-4)}`}
        </div>
        
        {/* Buy Button */}
        <Button
          onClick={() => onBuy(listing)}
          disabled
          className="w-full bg-gradient-to-r from-yellow-500 to-sky-500 hover:from-yellow-400 hover:to-sky-400 text-slate-900 font-bold text-xs py-2 opacity-50 cursor-not-allowed"
          data-testid={`buy-btn-${listing.id}`}
        >
          <Clock className="w-3 h-3 mr-1" />
          Coming Soon
        </Button>
      </div>
    </div>
  );
};

const Marketplace = () => {
  const { isConnected, address } = useAccount();
  const { isTelegram, telegramUser } = useTelegram();
  
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [ingredientMap, setIngredientMap] = useState({});
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });

  const effectiveAddress = isTelegram && telegramUser 
    ? `TG_${telegramUser.id}` 
    : address;

  const rarities = ['all', 'mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' }
  ];

  // Fetch ingredients catalog for mapping
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/ingredients/catalog`);
        if (response.ok) {
          const data = await response.json();
          const ingMap = {};
          (data.ingredients || []).forEach(ing => {
            ingMap[ing.id] = ing.name;
          });
          setIngredientMap(ingMap);
        }
      } catch (err) {
        console.error('Error fetching ingredients:', err);
      }
    };
    fetchIngredients();
  }, []);

  // Fetch marketplace listings
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRarity !== 'all') params.append('rarity', selectedRarity);
      params.append('sort_by', sortBy);
      if (priceRange.min) params.append('min_price_doge', priceRange.min);
      if (priceRange.max) params.append('max_price_doge', priceRange.max);
      
      const response = await fetch(`${BACKEND_URL}/api/marketplace/listings?${params}`);
      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
      }
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedRarity, sortBy, priceRange]);

  // Fetch marketplace stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/marketplace/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Filter listings by search
  const filteredListings = listings.filter(listing => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      listing.treat_name?.toLowerCase().includes(query) ||
      listing.seller_nickname?.toLowerCase().includes(query)
    );
  });

  const handleBuy = (listing) => {
    // Trading not live yet
    alert('Trading is not live yet. Stay tuned for $LAB token launch!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" data-testid="marketplace-page">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-sky-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Store className="w-6 h-6 text-sky-400" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-sky-400 bg-clip-text text-transparent">
                Marketplace
              </h1>
            </div>
          </div>
          
          {/* Stats Pills */}
          <div className="hidden md:flex items-center gap-3">
            <div className="px-3 py-1 bg-sky-500/20 rounded-full text-xs">
              <span className="text-slate-400">Listings:</span>
              <span className="text-sky-400 font-bold ml-1">{stats?.active_listings || 0}</span>
            </div>
            <div className="px-3 py-1 bg-yellow-500/20 rounded-full text-xs">
              <span className="text-slate-400">Fee:</span>
              <span className="text-yellow-400 font-bold ml-1">{stats?.marketplace_fee || 0.420} DOGE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Trading Not Live Banner */}
      <div className="bg-gradient-to-r from-yellow-500/20 via-sky-500/20 to-yellow-500/20 border-b border-yellow-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-yellow-200">
            <span className="font-bold">Trading Coming Soon!</span> List your treats now. Buying enabled when $LAB launches.
          </span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and Filters Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search treats or sellers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              data-testid="marketplace-search"
            />
          </div>
          
          {/* Filter Toggle */}
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className="border-sky-500/50 text-sky-400 hover:bg-sky-500/20"
            data-testid="filter-toggle-btn"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            data-testid="sort-select"
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <Card className="mb-6 bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 space-y-4">
              {/* Rarity Filter */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Rarity</label>
                <div className="flex flex-wrap gap-2">
                  {rarities.map(rarity => {
                    const config = rarity === 'all' ? null : getRarityConfig(rarity);
                    return (
                      <button
                        key={rarity}
                        onClick={() => setSelectedRarity(rarity)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          selectedRarity === rarity
                            ? rarity === 'all'
                              ? 'bg-white text-slate-900'
                              : `${config?.bg} ${config?.text} ${config?.border} border`
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                        }`}
                        data-testid={`filter-rarity-${rarity}`}
                      >
                        {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Price Range */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Price Range (DOGE)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                    className="w-24 bg-slate-700/50 border-slate-600 text-white text-sm"
                    data-testid="filter-price-min"
                  />
                  <span className="text-slate-500">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                    className="w-24 bg-slate-700/50 border-slate-600 text-white text-sm"
                    data-testid="filter-price-max"
                  />
                  <Button
                    onClick={() => setPriceRange({ min: '', max: '' })}
                    variant="ghost"
                    size="sm"
                    className="text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-400">
            {filteredListings.length} {filteredListings.length === 1 ? 'listing' : 'listings'} found
          </p>
          <Link to="/nfts">
            <Button variant="outline" size="sm" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20">
              <Tag className="w-4 h-4 mr-2" />
              List Your Treats
            </Button>
          </Link>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          </div>
        ) : filteredListings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredListings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                ingredientMap={ingredientMap}
                onBuy={handleBuy}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Store className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-bold text-slate-400 mb-2">No Listings Yet</h3>
            <p className="text-slate-500 mb-6">Be the first to list your treats on the marketplace!</p>
            <Link to="/nfts">
              <Button className="bg-gradient-to-r from-yellow-500 to-sky-500 text-slate-900 font-bold">
                <Sparkles className="w-4 h-4 mr-2" />
                List a Treat
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default Marketplace;

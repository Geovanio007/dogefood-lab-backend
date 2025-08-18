import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from './ui/use-toast';
import { 
  Shield, 
  Users, 
  Trophy, 
  DollarSign, 
  AlertTriangle, 
  Settings,
  TrendingUp,
  Eye,
  Ban,
  CheckCircle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminDashboard = () => {
  const [gameStats, setGameStats] = useState({});
  const [flaggedPlayers, setFlaggedPlayers] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const { toast } = useToast();

  // Simple admin authentication (in production, use proper auth)
  const ADMIN_KEY = 'dogefood_admin_2024';

  useEffect(() => {
    if (isAuthorized) {
      loadDashboardData();
    }
  }, [isAuthorized]);

  const handleAdminAuth = () => {
    if (adminKey === ADMIN_KEY) {
      setIsAuthorized(true);
      toast({
        title: "Access Granted",
        description: "Welcome to the DogeFood Lab Admin Dashboard",
        className: "bg-green-100 border-green-400"
      });
    } else {
      toast({
        title: "Access Denied",
        description: "Invalid admin key",
        variant: "destructive"
      });
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load game stats
      const statsResponse = await fetch(`${BACKEND_URL}/api/stats`);
      const stats = await statsResponse.json();
      setGameStats(stats);

      // Load flagged players
      const flaggedResponse = await fetch(`${BACKEND_URL}/api/security/flagged-players?risk_level=high`);
      const flagged = await flaggedResponse.json();
      setFlaggedPlayers(flagged.flagged_players || []);

      // Load enhanced seasons (using new season management)
      try {
        const enhancedSeasonsResponse = await fetch(`${BACKEND_URL}/api/seasons`);
        const enhancedSeasonData = await enhancedSeasonsResponse.json();
        setSeasons(enhancedSeasonData.seasons || []);
      } catch (seasonError) {
        // Fallback to old seasons API
        const seasonsResponse = await fetch(`${BACKEND_URL}/api/rewards/seasons`);
        const seasonData = await seasonsResponse.json();
        setSeasons(seasonData.seasons || []);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load admin dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <CardTitle className="text-2xl">Admin Access Required</CardTitle>
            <p className="text-gray-600">Enter admin key to access the dashboard</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter admin key..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleAdminAuth()}
            />
            <Button onClick={handleAdminAuth} className="w-full">
              <Shield className="w-4 h-4 mr-2" />
              Access Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
              <Shield className="w-10 h-10 text-blue-600" />
              DogeFood Lab Admin
            </h1>
            <p className="text-gray-600 mt-2">Season Management & Anti-Cheat Monitoring</p>
          </div>
          <Button 
            onClick={loadDashboardData}
            variant="outline"
            className="bg-white"
          >
            Refresh Data
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Players</p>
                  <p className="text-3xl font-bold text-gray-900">{gameStats.total_players || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">NFT Holders</p>
                  <p className="text-3xl font-bold text-green-600">{gameStats.nft_holders || 0}</p>
                </div>
                <Trophy className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Treats</p>
                  <p className="text-3xl font-bold text-purple-600">{gameStats.total_treats || 0}</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Today</p>
                  <p className="text-3xl font-bold text-orange-600">{gameStats.active_today || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="seasons" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white">
            <TabsTrigger value="seasons" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Season Management
            </TabsTrigger>
            <TabsTrigger value="game-engine" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Game Engine
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Anti-Cheat Monitor
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="seasons" className="mt-6">
            <EnhancedSeasonManagement 
              seasons={seasons} 
              onRefresh={loadDashboardData}
              toast={toast}
            />
          </TabsContent>

          <TabsContent value="game-engine" className="mt-6">
            <GameEngineManagement 
              onRefresh={loadDashboardData}
              toast={toast}
            />
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <SecurityMonitoring 
              flaggedPlayers={flaggedPlayers}
              onRefresh={loadDashboardData}
              toast={toast}
            />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsDashboard 
              gameStats={gameStats}
              toast={toast}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Enhanced Season Management Component
const EnhancedSeasonManagement = ({ seasons, onRefresh, toast }) => {
  const [currentSeason, setCurrentSeason] = useState(null);
  const [seasonStats, setSeasonStats] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCurrentSeason();
  }, []);

  const loadCurrentSeason = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/seasons/current`);
      const data = await response.json();
      setCurrentSeason(data.season);
      
      // Load current season stats
      if (data.season) {
        const statsResponse = await fetch(`${BACKEND_URL}/api/seasons/${data.season.season_id}`);
        const statsData = await statsResponse.json();
        setSeasonStats(statsData.stats || {});
      }
    } catch (error) {
      console.error('Error loading current season:', error);
    } finally {
      setLoading(false);
    }
  };

  const activateSeason = async (seasonId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/seasons/${seasonId}/activate`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast({
          title: "Season Activated!",
          description: `Season ${seasonId} has been activated`,
          className: "bg-green-100 border-green-400"
        });
        loadCurrentSeason();
        onRefresh();
      } else {
        throw new Error('Failed to activate season');
      }
    } catch (error) {
      toast({
        title: "Activation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading season data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Season Info */}
      {currentSeason && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold-500" />
              Current Season: {currentSeason.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Season ID</p>
                <p className="text-2xl font-bold">{currentSeason.season_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge variant={currentSeason.status === 'active' ? 'default' : 'secondary'}>
                  {currentSeason.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">Participants</p>
                <p className="text-2xl font-bold text-blue-600">
                  {seasonStats.total_participants || 0}
                </p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Duration:</strong> {currentSeason.start_date} to {currentSeason.end_date}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Description:</strong> {currentSeason.description}
              </p>
            </div>

            {seasonStats.rarity_distribution && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Treat Distribution This Season</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-gray-100 rounded">
                    <p className="text-sm text-gray-600">Common</p>
                    <p className="font-bold">{seasonStats.rarity_distribution.Common || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-blue-100 rounded">
                    <p className="text-sm text-blue-600">Rare</p>
                    <p className="font-bold text-blue-600">{seasonStats.rarity_distribution.Rare || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-purple-100 rounded">
                    <p className="text-sm text-purple-600">Epic</p>
                    <p className="font-bold text-purple-600">{seasonStats.rarity_distribution.Epic || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-yellow-100 rounded">
                    <p className="text-sm text-yellow-600">Legendary</p>
                    <p className="font-bold text-yellow-600">{seasonStats.rarity_distribution.Legendary || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Season List */}
      <Card>
        <CardHeader>
          <CardTitle>All Seasons</CardTitle>
        </CardHeader>
        <CardContent>
          {seasons.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No seasons found</p>
          ) : (
            <div className="space-y-4">
              {seasons.map((season, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-lg">
                        Season {season.season_id}: {season.name}
                      </h4>
                      <p className="text-gray-600">
                        {season.start_date} to {season.end_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={season.status === 'active' ? 'default' : 'secondary'}>
                        {season.status}
                      </Badge>
                      {season.status !== 'active' && (
                        <Button 
                          size="sm" 
                          onClick={() => activateSeason(season.season_id)}
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    {season.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Game Engine Management Component
const GameEngineManagement = ({ onRefresh, toast }) => {
  const [timerProgression, setTimerProgression] = useState([]);
  const [ingredientStats, setIngredientStats] = useState({});
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationForm, setSimulationForm] = useState({
    ingredients: 'strawberry,chocolate,honey,milk,banana',
    level: 15,
    simulations: 10
  });

  useEffect(() => {
    loadGameEngineData();
  }, []);

  const loadGameEngineData = async () => {
    try {
      // Load timer progression
      const timerResponse = await fetch(`${BACKEND_URL}/api/game/timer-progression?max_level=30`);
      const timerData = await timerResponse.json();
      setTimerProgression(timerData.progression || []);

      // Load ingredient stats  
      const ingredientResponse = await fetch(`${BACKEND_URL}/api/ingredients/stats`);
      const ingredientData = await ingredientResponse.json();
      setIngredientStats(ingredientData);
    } catch (error) {
      console.error('Error loading game engine data:', error);
    }
  };

  const runSimulation = async () => {
    try {
      const ingredients = simulationForm.ingredients.split(',').map(i => i.trim());
      
      const response = await fetch(`${BACKEND_URL}/api/game/simulate-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          player_level: simulationForm.level,
          player_address: '0x1234567890123456789012345678901234567890',
          simulations: simulationForm.simulations
        })
      });

      const data = await response.json();
      setSimulationResults(data);
      
      toast({
        title: "Simulation Complete!",
        description: `Ran ${data.simulations_run} simulations`,
        className: "bg-green-100 border-green-400"
      });
    } catch (error) {
      toast({
        title: "Simulation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Timer Progression Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Timer Progression by Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {timerProgression.slice(0, 20).map((level) => (
              <div key={level.level} className="text-center p-2 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Level {level.level}</p>
                <p className="font-bold">{level.timer_formatted}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Formula:</strong> Exponential scaling with 1-hour base time.
              Level 1: 1h → Level 10: ~5.2h → Level 30: 12h (capped)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ingredient System Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Ingredient System Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Ingredients</p>
              <p className="text-2xl font-bold">{ingredientStats.total_ingredients || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ingredient Types</p>
              <p className="text-2xl font-bold text-green-600">
                {ingredientStats.ingredient_types ? ingredientStats.ingredient_types.length : 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Max Unlock Level</p>
              <p className="text-2xl font-bold text-purple-600">
                {ingredientStats.max_unlock_level || 0}
              </p>
            </div>
          </div>

          {ingredientStats.rarity_distribution && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Rarity Distribution</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(ingredientStats.rarity_distribution).map(([rarity, count]) => (
                  <div key={rarity} className="text-center p-2 bg-gray-100 rounded">
                    <p className="text-sm text-gray-600 capitalize">{rarity}</p>
                    <p className="font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rarity Testing Simulation */}
      <Card>
        <CardHeader>
          <CardTitle>Rarity Distribution Testing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingredients (comma-separated)
                </label>
                <input
                  type="text"
                  value={simulationForm.ingredients}
                  onChange={(e) => setSimulationForm({
                    ...simulationForm,
                    ingredients: e.target.value
                  })}
                  placeholder="strawberry,chocolate,honey"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player Level
                </label>
                <input
                  type="number"
                  value={simulationForm.level}
                  onChange={(e) => setSimulationForm({
                    ...simulationForm,
                    level: parseInt(e.target.value) || 1
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Simulations
                </label>
                <input
                  type="number"
                  value={simulationForm.simulations}
                  onChange={(e) => setSimulationForm({
                    ...simulationForm,
                    simulations: parseInt(e.target.value) || 10
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <Button onClick={runSimulation} className="w-full md:w-auto">
              Run Rarity Simulation
            </Button>

            {simulationResults && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">
                  Simulation Results ({simulationResults.simulations_run} runs)
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {Object.entries(simulationResults.rarity_distribution).map(([rarity, count]) => {
                    const percentage = ((count / simulationResults.simulations_run) * 100).toFixed(1);
                    return (
                      <div key={rarity} className="text-center p-2 bg-white rounded border">
                        <p className="text-sm text-gray-600">{rarity}</p>
                        <p className="font-bold">{count}</p>
                        <p className="text-xs text-gray-500">{percentage}%</p>
                      </div>
                    );
                  })}
                </div>
                
                <p className="text-sm text-gray-600">
                  <strong>Expected:</strong> Legendary ~10%, Epic ~20%, Rare ~30%, Common ~40%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Original Season Management Component (kept for backward compatibility)
const SeasonManagement = ({ seasons, onRefresh, toast }) => {
  const [newSeasonData, setNewSeasonData] = useState({
    seasonId: '',
    rewardPoolTokens: 100000
  });
  const [generating, setGenerating] = useState(false);

  const handleGenerateSeason = async () => {
    if (!newSeasonData.seasonId) {
      toast({
        title: "Missing Data",
        description: "Please enter a season ID",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/rewards/generate-season/${newSeasonData.seasonId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reward_pool_tokens: newSeasonData.rewardPoolTokens
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Season Generated!",
          description: `Season ${newSeasonData.seasonId} created with ${result.total_recipients} recipients`,
          className: "bg-green-100 border-green-400"
        });
        
        setNewSeasonData({ seasonId: '', rewardPoolTokens: 100000 });
        onRefresh();
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate season');
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate New Season */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Generate New Season
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Season ID
              </label>
              <input
                type="number"
                value={newSeasonData.seasonId}
                onChange={(e) => setNewSeasonData({
                  ...newSeasonData, 
                  seasonId: e.target.value
                })}
                placeholder="e.g., 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reward Pool (LAB tokens)
              </label>
              <input
                type="number"
                value={newSeasonData.rewardPoolTokens}
                onChange={(e) => setNewSeasonData({
                  ...newSeasonData, 
                  rewardPoolTokens: parseInt(e.target.value) || 0
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={handleGenerateSeason}
                disabled={generating}
                className="w-full"
              >
                {generating ? 'Generating...' : 'Generate Season'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Seasons */}
      <Card>
        <CardHeader>
          <CardTitle>Season History</CardTitle>
        </CardHeader>
        <CardContent>
          {seasons.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No seasons generated yet</p>
          ) : (
            <div className="space-y-4">
              {seasons.map((season, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-lg">Season {season.season_id}</h4>
                      <p className="text-gray-600">
                        {season.total_recipients} recipients • {(season.total_rewards / 1000000).toFixed(2)} tokens
                      </p>
                    </div>
                    <Badge variant={season.status === 'generated' ? 'default' : 'secondary'}>
                      {season.status}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    <p>Merkle Root: <code className="bg-gray-100 px-1 rounded">{season.merkle_root}</code></p>
                    <p>Generated: {new Date(season.generated_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Security Monitoring Component
const SecurityMonitoring = ({ flaggedPlayers, onRefresh, toast }) => {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerDetails, setPlayerDetails] = useState(null);

  const handleViewPlayer = async (playerAddress) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/security/player-risk/${playerAddress}`);
      const details = await response.json();
      setPlayerDetails(details);
      setSelectedPlayer(playerAddress);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load player details",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            High-Risk Players
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flaggedPlayers.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-500">No high-risk players detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flaggedPlayers.map((player, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {player._id.slice(0, 10)}...{player._id.slice(-8)}
                      </p>
                      <p className="text-sm text-red-600">
                        {player.violations} violations • Last: {new Date(player.latest_violation).toLocaleString()}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewPlayer(player._id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player Details Modal-like Section */}
      {selectedPlayer && playerDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Player Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p><strong>Address:</strong> {selectedPlayer}</p>
                <p><strong>Risk Score:</strong> {playerDetails.risk_score}</p>
                <p><strong>Risk Level:</strong> 
                  <Badge variant={playerDetails.risk_level === 'high' ? 'destructive' : 'default'} className="ml-2">
                    {playerDetails.risk_level}
                  </Badge>
                </p>
                <p><strong>Recent Violations:</strong> {playerDetails.recent_violations}</p>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => setSelectedPlayer(null)}
              >
                Close Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Analytics Dashboard Component
const AnalyticsDashboard = ({ gameStats, toast }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Player Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Total Players</span>
                <span className="font-bold">{gameStats.total_players || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>NFT Holders</span>
                <span className="font-bold text-green-600">{gameStats.nft_holders || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Regular Players</span>
                <span className="font-bold">{(gameStats.total_players || 0) - (gameStats.nft_holders || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>NFT Holder %</span>
                <span className="font-bold text-blue-600">
                  {gameStats.total_players > 0 
                    ? ((gameStats.nft_holders / gameStats.total_players) * 100).toFixed(1) 
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Total Treats</span>
                <span className="font-bold">{gameStats.total_treats || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Active Today</span>
                <span className="font-bold text-orange-600">{gameStats.active_today || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Treats per Player</span>
                <span className="font-bold">
                  {gameStats.total_players > 0 
                    ? (gameStats.total_treats / gameStats.total_players).toFixed(1) 
                    : 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Activity Rate</span>
                <span className="font-bold text-green-600">
                  {gameStats.total_players > 0 
                    ? ((gameStats.active_today / gameStats.total_players) * 100).toFixed(1) 
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
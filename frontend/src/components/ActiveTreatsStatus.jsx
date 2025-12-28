import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Clock, Trophy, Zap, ArrowLeft } from 'lucide-react';

const ActiveTreatsStatus = () => {
  const { address, isConnected } = useAccount();
  const [activeTreats, setActiveTreats] = useState([]);
  const [readyTreats, setReadyTreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Update current time every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    if (!address || !isConnected) {
      setActiveTreats([]);
      setReadyTreats([]);
      setLoading(false);
      return;
    }
    
    const fetchActiveTreats = async () => {
      try {
        setLoading(true);
        
        // Fetch all treats for the player
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/treats/${address}`);
        
        if (response.ok) {
          const allTreats = await response.json();
          const now = Date.now();
          
          // Separate brewing and ready treats
          const brewing = [];
          const ready = [];
          
          allTreats.forEach(treat => {
            const readyTime = new Date(treat.ready_at).getTime();
            
            if (treat.brewing_status === 'brewing' && now < readyTime) {
              brewing.push(treat);
            } else if (treat.brewing_status === 'brewing' || now >= readyTime) {
              ready.push(treat);
            }
          });
          
          setActiveTreats(brewing);
          setReadyTreats(ready);
        }
      } catch (error) {
        console.error('Error fetching active treats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Fetch immediately
    fetchActiveTreats();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchActiveTreats, 60000);
    
    return () => clearInterval(interval);
  }, [address, isConnected]);
  
  const formatTimeRemaining = (readyAt) => {
    const readyTime = new Date(readyAt).getTime();
    const remaining = Math.max(0, readyTime - currentTime);
    
    if (remaining === 0) return "Ready!";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };
  
  const getTreatProgressPercent = (readyAt) => {
    const readyTime = new Date(readyAt).getTime();
    const startTime = readyTime - (1 * 60 * 60 * 1000); // Assume 1 hour duration for now
    const elapsed = currentTime - startTime;
    const total = readyTime - startTime;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };
  
  if (!isConnected) {
    return (
      <Card className="glass-panel border-orange-400">
        <CardContent className="text-center p-6">
          <div className="text-4xl mb-2">🔗</div>
          <p className="text-gray-600">Connect your wallet to see your active treats</p>
        </CardContent>
      </Card>
    );
  }
  
  if (loading) {
    return (
      <Card className="glass-panel">
        <CardContent className="text-center p-6">
          <div className="text-4xl mb-2">⏳</div>
          <p className="text-gray-600">Loading your treats...</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Ready Treats Notification */}
      {readyTreats.length > 0 && (
        <Card className="glass-panel border-4 border-green-400 bg-green-50/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Trophy className="w-5 h-5" />
              🎉 Treats Ready for Collection!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {readyTreats.length}
              </div>
              <p className="text-green-700 mb-4">
                {readyTreats.length === 1 ? 'treat is' : 'treats are'} ready to collect!
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {readyTreats.slice(0, 8).map(treat => (
                  <div key={treat.id} className="bg-white/80 rounded-lg p-2 text-center">
                    <div className="mb-1">
                      <img 
                        src={treat.image || "https://customer-assets.emergentagent.com/job_shibalab/artifacts/l9ufequf_20250720_2152_Shiba_Pouring_Cereal_remix_01k0mp753tfzxs9v4dqxhtp2ng-removebg-preview.png"}
                        alt={treat.name || 'DogeFood Treat'}
                        className="w-8 h-8 object-contain mx-auto"
                        onError={(e) => {
                          e.target.src = "https://customer-assets.emergentagent.com/job_shibalab/artifacts/l9ufequf_20250720_2152_Shiba_Pouring_Cereal_remix_01k0mp753tfzxs9v4dqxhtp2ng-removebg-preview.png";
                        }}
                      />
                    </div>
                    <div className="text-xs font-medium">{treat.rarity}</div>
                    <Badge className="text-xs bg-green-500 text-white">Ready!</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Active Brewing Treats */}
      {activeTreats.length > 0 && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Currently Brewing ({activeTreats.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTreats.map(treat => (
                <div key={treat.id} className="bg-white/50 rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <img 
                        src={treat.image || "https://customer-assets.emergentagent.com/job_shibalab/artifacts/l9ufequf_20250720_2152_Shiba_Pouring_Cereal_remix_01k0mp753tfzxs9v4dqxhtp2ng-removebg-preview.png"}
                        alt={treat.name || 'DogeFood Treat'}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          e.target.src = "https://customer-assets.emergentagent.com/job_shibalab/artifacts/l9ufequf_20250720_2152_Shiba_Pouring_Cereal_remix_01k0mp753tfzxs9v4dqxhtp2ng-removebg-preview.png";
                        }}
                      />
                      <div>
                        <div className="font-medium">{treat.name}</div>
                        <Badge className={`text-xs ${
                          treat.rarity === 'Legendary' ? 'bg-yellow-500' :
                          treat.rarity === 'Epic' ? 'bg-purple-500' :
                          treat.rarity === 'Rare' ? 'bg-blue-500' : 'bg-gray-500'
                        } text-white`}>
                          {treat.rarity}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">
                        {formatTimeRemaining(treat.ready_at)}
                      </div>
                      <div className="text-xs text-gray-500">remaining</div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${getTreatProgressPercent(treat.ready_at)}%` }}
                    />
                  </div>
                  
                  <div className="text-xs text-gray-600">
                    Ready at: {new Date(treat.ready_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* No Active Treats */}
      {activeTreats.length === 0 && readyTreats.length === 0 && (
        <Card className="glass-panel">
          <CardContent className="text-center p-6">
            <div className="text-4xl mb-2">🧪</div>
            <p className="text-gray-600 mb-4">No active treats brewing</p>
            <p className="text-sm text-gray-500">
              Head to the Lab to start creating some magical treats!
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Return to Menu Button */}
      <div className="mt-6">
        <Link to="/">
          <Button className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white py-3">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default ActiveTreatsStatus;
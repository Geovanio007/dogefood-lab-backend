import React, { useState, useEffect } from 'react';
import { useTreatTracker } from '../hooks/useTreatTracker';

const ActiveTreats = ({ playerAddress }) => {
  const { activeTreats, completedTreats, getTimeRemaining } = useTreatTracker(playerAddress);
  const [currentTime, setCurrentTime] = useState(new Date().getTime());

  // Update current time every second for live timers
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().getTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const TreatCard = ({ treat, isCompleted = false }) => {
    const timeInfo = isCompleted ? null : getTimeRemaining(treat.ready_at);
    
    return (
      <div className={`
        bg-white rounded-xl shadow-lg p-4 border-2 transition-all duration-300
        ${isCompleted 
          ? 'border-green-400 bg-green-50 animate-pulse' 
          : 'border-blue-200 hover:border-blue-400'
        }
      `}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{treat.image || '🍖'}</span>
            <div>
              <h3 className="font-bold text-sm text-gray-800">{treat.name}</h3>
              <span className={`
                text-xs px-2 py-1 rounded-full font-medium
                ${treat.rarity === 'Legendary' ? 'bg-yellow-100 text-yellow-800' :
                  treat.rarity === 'Epic' ? 'bg-purple-100 text-purple-800' :
                  treat.rarity === 'Rare' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'}
              `}>
                {treat.rarity}
              </span>
            </div>
          </div>
          
          {isCompleted ? (
            <div className="text-center">
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                READY! 🎉
              </div>
            </div>
          ) : timeInfo?.isReady ? (
            <div className="text-center">
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-bounce">
                READY! 🎉
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-sm font-mono text-gray-600">
                {String(timeInfo?.hours || 0).padStart(2, '0')}:
                {String(timeInfo?.minutes || 0).padStart(2, '0')}:
                {String(timeInfo?.seconds || 0).padStart(2, '0')}
              </div>
              <div className="text-xs text-gray-500">remaining</div>
            </div>
          )}
        </div>

        {/* Ingredients */}
        <div className="mb-3">
          <div className="text-xs text-gray-600 mb-1">Ingredients:</div>
          <div className="flex flex-wrap gap-1">
            {treat.ingredients?.map((ingredient, index) => (
              <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                {ingredient}
              </span>
            ))}
          </div>
        </div>

        {/* Progress Bar for Active Treats */}
        {!isCompleted && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`
                h-2 rounded-full transition-all duration-1000
                ${timeInfo?.isReady ? 'bg-green-500' : 'bg-blue-500'}
              `}
              style={{ 
                width: timeInfo?.isReady ? '100%' : 
                       `${Math.max(10, 100 - ((timeInfo?.hours * 60 + timeInfo?.minutes) / 60) * 100)}%`
              }}
            />
          </div>
        )}
      </div>
    );
  };

  if (!playerAddress) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Connect your wallet to see your treats</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active/Brewing Treats */}
      {activeTreats.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            🧪 Brewing Treats ({activeTreats.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTreats.map((treat) => (
              <TreatCard key={treat.id} treat={treat} />
            ))}
          </div>
        </div>
      )}

      {/* Ready/Completed Treats */}
      {completedTreats.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            ✅ Ready Treats ({completedTreats.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedTreats.map((treat) => (
              <TreatCard key={treat.id} treat={treat} isCompleted={true} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeTreats.length === 0 && completedTreats.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🧪</div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">No Treats Yet</h3>
          <p className="text-gray-500 mb-4">
            Start mixing ingredients to create your first treat!
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <strong>How it works:</strong>
            <br />
            1. Select 2+ ingredients from the shelf
            <br />
            2. Click "Start Mixing" to begin brewing
            <br />
            3. Wait for your treat to be ready (time varies by level)
            <br />
            4. Come back to collect your treat!
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveTreats;
import React, { useEffect, useState } from 'react';
import { useTreatTracker } from '../hooks/useTreatTracker';
import { useToast } from './ui/use-toast';

const TreatNotifications = ({ playerAddress }) => {
  const { activeTreats, completedTreats } = useTreatTracker(playerAddress);
  const { toast } = useToast();
  const [notifiedTreats, setNotifiedTreats] = useState(new Set());

  // Check for newly completed treats and notify user
  useEffect(() => {
    if (!playerAddress) return;

    completedTreats.forEach(treat => {
      if (!notifiedTreats.has(treat.id)) {
        // Show notification for completed treat
        toast({
          title: "🎉 Treat Ready!",
          description: `Your ${treat.rarity} treat "${treat.name}" is ready to collect!`,
          className: "bg-green-100 border-green-400",
          duration: 5000,
        });

        // Mark as notified
        setNotifiedTreats(prev => new Set([...prev, treat.id]));
      }
    });
  }, [completedTreats, notifiedTreats, toast, playerAddress]);

  // Check for treats that are almost ready (5 minutes left)
  useEffect(() => {
    if (!playerAddress || activeTreats.length === 0) return;

    const checkAlmostReady = () => {
      const now = new Date().getTime();
      
      activeTreats.forEach(treat => {
        const readyTime = new Date(treat.ready_at).getTime();
        const timeLeft = readyTime - now;
        const almostReadyThreshold = 5 * 60 * 1000; // 5 minutes
        
        if (timeLeft > 0 && timeLeft <= almostReadyThreshold && !notifiedTreats.has(`almost_${treat.id}`)) {
          toast({
            title: "⏰ Almost Ready!",
            description: `Your ${treat.rarity} treat will be ready in less than 5 minutes!`,
            className: "bg-yellow-100 border-yellow-400",
            duration: 4000,
          });

          // Mark as notified for "almost ready"
          setNotifiedTreats(prev => new Set([...prev, `almost_${treat.id}`]));
        }
      });
    };

    // Check every 30 seconds
    const interval = setInterval(checkAlmostReady, 30000);
    
    // Check immediately
    checkAlmostReady();

    return () => clearInterval(interval);
  }, [activeTreats, notifiedTreats, toast, playerAddress]);

  // Show persistent notification dot if there are ready treats
  if (completedTreats.length > 0) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-green-500 text-white px-4 py-2 rounded-full shadow-lg animate-pulse flex items-center gap-2">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
          <span className="font-bold">{completedTreats.length} Treat{completedTreats.length > 1 ? 's' : ''} Ready!</span>
        </div>
      </div>
    );
  }

  return null; // No persistent UI when no treats are ready
};

export default TreatNotifications;
import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useToast } from './ui/use-toast';

const TreatNotifications = () => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [checkedTreats, setCheckedTreats] = useState(new Set());
  
  useEffect(() => {
    if (!address || !isConnected) return;
    
    const checkTreats = async () => {
      try {
        // Get all brewing treats for this player
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/treats/${address}/brewing`);
        
        if (response.ok) {
          const brewingTreats = await response.json();
          const currentTime = Date.now();
          
          brewingTreats.forEach(treat => {
            const readyTime = new Date(treat.ready_at).getTime();
            const treatId = treat.id;
            
            // If treat is ready and we haven't notified about it yet
            if (currentTime >= readyTime && !checkedTreats.has(treatId)) {
              // Show notification
              toast({
                title: "🎉 Treat Ready!",
                description: `Your ${treat.rarity} treat "${treat.name}" is ready for collection!`,
                className: "bg-green-100 border-green-400",
                duration: 8000
              });
              
              // Mark as notified
              setCheckedTreats(prev => new Set([...prev, treatId]));
              
              // Play notification sound (optional)
              try {
                new Audio('/notification.mp3').play().catch(() => {});
              } catch (e) {
                // Ignore audio errors
              }
            }
          });
        }
      } catch (error) {
        console.error('Error checking treat notifications:', error);
      }
    };
    
    // Check immediately
    checkTreats();
    
    // Then check every 30 seconds
    const interval = setInterval(checkTreats, 30000);
    
    return () => clearInterval(interval);
  }, [address, isConnected, toast]);
  
  // This component doesn't render anything - it just handles notifications
  return null;
};

export default TreatNotifications;
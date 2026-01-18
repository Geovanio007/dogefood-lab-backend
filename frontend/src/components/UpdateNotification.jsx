import React from 'react';
import { useVersion } from '../contexts/VersionContext';

const UpdateNotification = () => {
  const { updateAvailable, applyUpdate, dismissUpdate } = useVersion();

  const handleRefresh = () => {
    // Dismiss first so card disappears immediately
    dismissUpdate();
    // Then apply update (reload page)
    setTimeout(() => applyUpdate(), 100);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 z-[9999] animate-slide-up"
      style={{ maxWidth: '400px', margin: '0 auto' }}
    >
      <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl shadow-2xl p-4 border-2 border-emerald-300">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm">
              🧪 New Lab Update!
            </h3>
            <p className="text-white/90 text-xs mt-0.5">
              Fresh experiments await! Tap refresh to get the latest.
            </p>
          </div>
          
          {/* Close button */}
          <button
            onClick={dismissUpdate}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={applyUpdate}
            className="flex-1 bg-white text-amber-600 font-bold py-2 px-4 rounded-xl text-sm hover:bg-amber-50 transition-colors shadow-lg"
          >
            🔄 Refresh Now
          </button>
          <button
            onClick={dismissUpdate}
            className="px-4 py-2 text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            Later
          </button>
        </div>
      </div>
      
      <style jsx="true">{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default UpdateNotification;

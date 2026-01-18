import React, { useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { Bell, BellOff, Check, X, Smartphone, Monitor } from 'lucide-react';

const NotificationPrompt = ({ onClose }) => {
  const { 
    requestPermission, 
    isTelegramNotifications,
    permissionStatus 
  } = useNotifications();
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleEnable = async () => {
    setIsLoading(true);
    const success = await requestPermission();
    setResult(success ? 'success' : 'failed');
    setIsLoading(false);
    
    if (success) {
      setTimeout(() => onClose?.(), 1500);
    }
  };

  if (result === 'success') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Notifications Enabled!</h3>
          <p className="text-white/80 text-sm">
            You'll be notified when your treats are ready and when you can create more.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-700">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Bell className="w-8 h-8 text-white" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-2">
          Never Miss a Treat! 🍖
        </h3>

        {/* Description */}
        <p className="text-slate-300 text-sm text-center mb-4">
          Get notified when:
        </p>

        {/* Benefits */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-3 bg-slate-700/50 rounded-xl p-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">✅</span>
            </div>
            <span className="text-white text-sm">Your treats are ready to collect</span>
          </div>
          <div className="flex items-center gap-3 bg-slate-700/50 rounded-xl p-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">🔄</span>
            </div>
            <span className="text-white text-sm">Daily limit resets - time to brew!</span>
          </div>
        </div>

        {/* Platform indicator */}
        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs mb-4">
          {isTelegramNotifications ? (
            <>
              <Smartphone className="w-4 h-4" />
              <span>Via Telegram</span>
            </>
          ) : (
            <>
              <Monitor className="w-4 h-4" />
              <span>Via Browser Push</span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-700 text-slate-300 font-semibold hover:bg-slate-600 transition-colors"
          >
            Not Now
          </button>
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-600 hover:to-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Enable
              </>
            )}
          </button>
        </div>

        {result === 'failed' && (
          <p className="text-red-400 text-xs text-center mt-3">
            Failed to enable notifications. Please try again or check your browser settings.
          </p>
        )}
      </div>
    </div>
  );
};

// Notification Settings Panel (for Settings page)
export const NotificationSettings = () => {
  const {
    notificationsEnabled,
    treatReadyNotify,
    limitResetNotify,
    permissionStatus,
    isTelegramNotifications,
    requestPermission,
    disableNotifications,
    updatePreferences,
    setShowPermissionPrompt
  } = useNotifications();

  const [isLoading, setIsLoading] = useState(false);

  const handleToggleNotifications = async () => {
    setIsLoading(true);
    if (notificationsEnabled) {
      await disableNotifications();
    } else {
      await requestPermission();
    }
    setIsLoading(false);
  };

  const handleToggleTreatReady = () => {
    updatePreferences(!treatReadyNotify, limitResetNotify);
  };

  const handleToggleLimitReset = () => {
    updatePreferences(treatReadyNotify, !limitResetNotify);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {notificationsEnabled ? (
            <Bell className="w-5 h-5 text-green-400" />
          ) : (
            <BellOff className="w-5 h-5 text-slate-400" />
          )}
          <div>
            <h4 className="text-white font-medium">Push Notifications</h4>
            <p className="text-slate-400 text-xs">
              {isTelegramNotifications ? 'Via Telegram' : 'Via Browser'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleNotifications}
          disabled={isLoading}
          className={`w-12 h-7 rounded-full transition-colors relative ${
            notificationsEnabled ? 'bg-green-500' : 'bg-slate-600'
          }`}
        >
          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
            notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {notificationsEnabled && (
        <div className="pl-8 space-y-3 border-l-2 border-slate-700 ml-2">
          {/* Treat Ready */}
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-white text-sm">Treat Ready</h5>
              <p className="text-slate-400 text-xs">When treats finish brewing</p>
            </div>
            <button
              onClick={handleToggleTreatReady}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                treatReadyNotify ? 'bg-amber-500' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                treatReadyNotify ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Limit Reset */}
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-white text-sm">Limit Reset</h5>
              <p className="text-slate-400 text-xs">When daily limit refreshes</p>
            </div>
            <button
              onClick={handleToggleLimitReset}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                limitResetNotify ? 'bg-blue-500' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                limitResetNotify ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      )}

      {!notificationsEnabled && permissionStatus === 'denied' && (
        <p className="text-red-400 text-xs">
          Notifications are blocked. Please enable them in your browser settings.
        </p>
      )}
    </div>
  );
};

export default NotificationPrompt;

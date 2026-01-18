import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTelegram } from './TelegramContext';

const NotificationContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const NotificationProvider = ({ children }) => {
  const { telegramUser, isTelegram } = useTelegram();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('dogefood_notifications_enabled');
    return saved === 'true';
  });
  
  const [treatReadyNotify, setTreatReadyNotify] = useState(() => {
    const saved = localStorage.getItem('dogefood_treat_ready_notify');
    return saved !== 'false'; // Default true
  });
  
  const [limitResetNotify, setLimitResetNotify] = useState(() => {
    const saved = localStorage.getItem('dogefood_limit_reset_notify');
    return saved !== 'false'; // Default true
  });
  
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [pushSubscription, setPushSubscription] = useState(null);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('dogefood_notifications_enabled', notificationsEnabled.toString());
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('dogefood_treat_ready_notify', treatReadyNotify.toString());
  }, [treatReadyNotify]);

  useEffect(() => {
    localStorage.setItem('dogefood_limit_reset_notify', limitResetNotify.toString());
  }, [limitResetNotify]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    // For Telegram users, we use Telegram's native notifications
    if (isTelegram && telegramUser) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/notifications/telegram/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: telegramUser.id,
            treat_ready: treatReadyNotify,
            limit_reset: limitResetNotify
          })
        });
        
        if (response.ok) {
          setNotificationsEnabled(true);
          setPermissionStatus('granted');
          return true;
        }
      } catch (error) {
        console.error('Failed to subscribe to Telegram notifications:', error);
      }
      return false;
    }

    // For web users, use Web Push API
    if ('Notification' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission);
        
        if (permission === 'granted') {
          // Subscribe to push notifications
          const registration = await navigator.serviceWorker.ready;
          
          // Get VAPID public key from backend
          const vapidResponse = await fetch(`${BACKEND_URL}/api/notifications/vapid-key`);
          if (!vapidResponse.ok) {
            console.error('Failed to get VAPID key');
            return false;
          }
          const { publicKey } = await vapidResponse.json();
          
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
          });
          
          setPushSubscription(subscription);
          
          // Send subscription to backend
          const playerAddress = localStorage.getItem('dogefood_player_address') || 'anonymous';
          await fetch(`${BACKEND_URL}/api/notifications/web/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: subscription.toJSON(),
              player_address: playerAddress,
              treat_ready: treatReadyNotify,
              limit_reset: limitResetNotify
            })
          });
          
          setNotificationsEnabled(true);
          return true;
        }
      } catch (error) {
        console.error('Failed to subscribe to web push:', error);
      }
    }
    
    return false;
  }, [isTelegram, telegramUser, treatReadyNotify, limitResetNotify]);

  // Disable notifications
  const disableNotifications = useCallback(async () => {
    if (isTelegram && telegramUser) {
      try {
        await fetch(`${BACKEND_URL}/api/notifications/telegram/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_id: telegramUser.id })
        });
      } catch (error) {
        console.error('Failed to unsubscribe from Telegram notifications:', error);
      }
    } else if (pushSubscription) {
      try {
        await pushSubscription.unsubscribe();
        const playerAddress = localStorage.getItem('dogefood_player_address') || 'anonymous';
        await fetch(`${BACKEND_URL}/api/notifications/web/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_address: playerAddress })
        });
      } catch (error) {
        console.error('Failed to unsubscribe from web push:', error);
      }
    }
    
    setNotificationsEnabled(false);
    setPushSubscription(null);
  }, [isTelegram, telegramUser, pushSubscription]);

  // Update notification preferences
  const updatePreferences = useCallback(async (treatReady, limitReset) => {
    setTreatReadyNotify(treatReady);
    setLimitResetNotify(limitReset);
    
    if (!notificationsEnabled) return;
    
    try {
      if (isTelegram && telegramUser) {
        await fetch(`${BACKEND_URL}/api/notifications/telegram/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: telegramUser.id,
            treat_ready: treatReady,
            limit_reset: limitReset
          })
        });
      } else {
        const playerAddress = localStorage.getItem('dogefood_player_address') || 'anonymous';
        await fetch(`${BACKEND_URL}/api/notifications/web/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_address: playerAddress,
            treat_ready: treatReady,
            limit_reset: limitReset
          })
        });
      }
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  }, [notificationsEnabled, isTelegram, telegramUser]);

  // Show local notification (for immediate feedback)
  const showLocalNotification = useCallback((title, body, icon = '/dogefood-logo.png') => {
    if (!notificationsEnabled || permissionStatus !== 'granted') return;
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon, badge: icon });
    }
  }, [notificationsEnabled, permissionStatus]);

  // Schedule treat ready notification
  const scheduleTreatReadyNotification = useCallback(async (treatName, readyTime) => {
    if (!notificationsEnabled || !treatReadyNotify) return;
    
    try {
      if (isTelegram && telegramUser) {
        await fetch(`${BACKEND_URL}/api/notifications/schedule/treat-ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: telegramUser.id,
            treat_name: treatName,
            ready_time: readyTime
          })
        });
      } else {
        const playerAddress = localStorage.getItem('dogefood_player_address') || 'anonymous';
        await fetch(`${BACKEND_URL}/api/notifications/schedule/treat-ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_address: playerAddress,
            treat_name: treatName,
            ready_time: readyTime
          })
        });
      }
    } catch (error) {
      console.error('Failed to schedule treat notification:', error);
    }
  }, [notificationsEnabled, treatReadyNotify, isTelegram, telegramUser]);

  // Schedule limit reset notification
  const scheduleLimitResetNotification = useCallback(async (resetTime) => {
    if (!notificationsEnabled || !limitResetNotify) return;
    
    try {
      if (isTelegram && telegramUser) {
        await fetch(`${BACKEND_URL}/api/notifications/schedule/limit-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: telegramUser.id,
            reset_time: resetTime
          })
        });
      } else {
        const playerAddress = localStorage.getItem('dogefood_player_address') || 'anonymous';
        await fetch(`${BACKEND_URL}/api/notifications/schedule/limit-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_address: playerAddress,
            reset_time: resetTime
          })
        });
      }
    } catch (error) {
      console.error('Failed to schedule limit reset notification:', error);
    }
  }, [notificationsEnabled, limitResetNotify, isTelegram, telegramUser]);

  const value = {
    notificationsEnabled,
    treatReadyNotify,
    limitResetNotify,
    permissionStatus,
    showPermissionPrompt,
    isTelegramNotifications: isTelegram,
    
    setShowPermissionPrompt,
    requestPermission,
    disableNotifications,
    updatePreferences,
    showLocalNotification,
    scheduleTreatReadyNotification,
    scheduleLimitResetNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      notificationsEnabled: false,
      treatReadyNotify: true,
      limitResetNotify: true,
      permissionStatus: 'default',
      showPermissionPrompt: false,
      isTelegramNotifications: false,
      setShowPermissionPrompt: () => {},
      requestPermission: async () => false,
      disableNotifications: async () => {},
      updatePreferences: async () => {},
      showLocalNotification: () => {},
      scheduleTreatReadyNotification: async () => {},
      scheduleLimitResetNotification: async () => {}
    };
  }
  return context;
};

export default NotificationContext;

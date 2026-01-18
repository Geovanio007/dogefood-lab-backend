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
  const [isLoading, setIsLoading] = useState(false);

  // Check notification permission on mount
  useEffect(() => {
    if (!isTelegram && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, [isTelegram]);

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
    setIsLoading(true);
    
    try {
      // For Telegram users - register with backend for bot notifications
      if (isTelegram && telegramUser) {
        const response = await fetch(`${BACKEND_URL}/api/notifications/telegram/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: telegramUser.id,
            username: telegramUser.username || '',
            first_name: telegramUser.first_name || '',
            treat_ready: treatReadyNotify,
            limit_reset: limitResetNotify
          })
        });
        
        if (response.ok) {
          setNotificationsEnabled(true);
          setPermissionStatus('granted');
          setIsLoading(false);
          return true;
        } else {
          const error = await response.json();
          console.error('Telegram subscribe error:', error);
          setIsLoading(false);
          return false;
        }
      }

      // For web/desktop users - use browser notifications (simpler approach without push)
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission);
        
        if (permission === 'granted') {
          // Just save to backend that user enabled notifications
          const playerData = localStorage.getItem('dogefood_player');
          let playerAddress = 'anonymous';
          if (playerData) {
            try {
              const parsed = JSON.parse(playerData);
              playerAddress = parsed.guest_id || parsed.address || parsed.id || 'anonymous';
            } catch (e) {}
          }
          
          await fetch(`${BACKEND_URL}/api/notifications/web/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player_address: playerAddress,
              treat_ready: treatReadyNotify,
              limit_reset: limitResetNotify
            })
          });
          
          setNotificationsEnabled(true);
          setIsLoading(false);
          return true;
        }
      }
      
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      setIsLoading(false);
      return false;
    }
  }, [isTelegram, telegramUser, treatReadyNotify, limitResetNotify]);

  // Disable notifications
  const disableNotifications = useCallback(async () => {
    setIsLoading(true);
    
    try {
      if (isTelegram && telegramUser) {
        await fetch(`${BACKEND_URL}/api/notifications/telegram/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_id: telegramUser.id })
        });
      } else {
        const playerData = localStorage.getItem('dogefood_player');
        let playerAddress = 'anonymous';
        if (playerData) {
          try {
            const parsed = JSON.parse(playerData);
            playerAddress = parsed.guest_id || parsed.address || parsed.id || 'anonymous';
          } catch (e) {}
        }
        
        await fetch(`${BACKEND_URL}/api/notifications/web/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_address: playerAddress })
        });
      }
    } catch (error) {
      console.error('Failed to disable notifications:', error);
    }
    
    setNotificationsEnabled(false);
    setIsLoading(false);
  }, [isTelegram, telegramUser]);

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
        const playerData = localStorage.getItem('dogefood_player');
        let playerAddress = 'anonymous';
        if (playerData) {
          try {
            const parsed = JSON.parse(playerData);
            playerAddress = parsed.guest_id || parsed.address || parsed.id || 'anonymous';
          } catch (e) {}
        }
        
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

  // Show local browser notification
  const showLocalNotification = useCallback((title, body, icon = '/dogefood-logo.png') => {
    if (!notificationsEnabled) return;
    
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon, badge: icon });
      } catch (e) {
        console.warn('Failed to show notification:', e);
      }
    }
  }, [notificationsEnabled]);

  // Schedule treat ready notification
  const scheduleTreatReadyNotification = useCallback(async (treatName, readyTime) => {
    if (!notificationsEnabled || !treatReadyNotify) return;
    
    try {
      const body = {
        treat_name: treatName,
        ready_time: readyTime
      };
      
      if (isTelegram && telegramUser) {
        body.telegram_id = telegramUser.id;
      } else {
        const playerData = localStorage.getItem('dogefood_player');
        if (playerData) {
          try {
            const parsed = JSON.parse(playerData);
            body.player_address = parsed.guest_id || parsed.address || parsed.id || 'anonymous';
          } catch (e) {}
        }
      }
      
      await fetch(`${BACKEND_URL}/api/notifications/schedule/treat-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      console.error('Failed to schedule treat notification:', error);
    }
  }, [notificationsEnabled, treatReadyNotify, isTelegram, telegramUser]);

  // Schedule limit reset notification
  const scheduleLimitResetNotification = useCallback(async (resetTime) => {
    if (!notificationsEnabled || !limitResetNotify) return;
    
    try {
      const body = { reset_time: resetTime };
      
      if (isTelegram && telegramUser) {
        body.telegram_id = telegramUser.id;
      } else {
        const playerData = localStorage.getItem('dogefood_player');
        if (playerData) {
          try {
            const parsed = JSON.parse(playerData);
            body.player_address = parsed.guest_id || parsed.address || parsed.id || 'anonymous';
          } catch (e) {}
        }
      }
      
      await fetch(`${BACKEND_URL}/api/notifications/schedule/limit-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      console.error('Failed to schedule limit reset notification:', error);
    }
  }, [notificationsEnabled, limitResetNotify, isTelegram, telegramUser]);

  const value = {
    notificationsEnabled,
    treatReadyNotify,
    limitResetNotify,
    permissionStatus,
    isLoading,
    isTelegramNotifications: isTelegram,
    
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

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      notificationsEnabled: false,
      treatReadyNotify: true,
      limitResetNotify: true,
      permissionStatus: 'default',
      isLoading: false,
      isTelegramNotifications: false,
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

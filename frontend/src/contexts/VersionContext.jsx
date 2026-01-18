import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { setUpdateCallback, skipWaiting, checkForUpdates } from '../serviceWorkerRegistration';

const VersionContext = createContext(null);

// Generate build version from timestamp
const BUILD_VERSION = process.env.REACT_APP_VERSION || Date.now().toString(36);

// 24 hours in milliseconds
const DISMISS_DURATION = 24 * 60 * 60 * 1000;

export const VersionProvider = ({ children }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(BUILD_VERSION);
  const [newVersion, setNewVersion] = useState(null);
  const checkIntervalRef = useRef(null);

  // Check if we should show notification based on dismiss time and version
  const shouldShowNotification = useCallback((serverVersion) => {
    const dismissData = localStorage.getItem('dogefood_update_dismissed');
    
    if (!dismissData) {
      return true; // Never dismissed, show it
    }
    
    try {
      const { version, timestamp } = JSON.parse(dismissData);
      const now = Date.now();
      
      // If it's a different version than what was dismissed, show it
      if (version !== serverVersion) {
        return true;
      }
      
      // If 24 hours have passed since dismissing, show it again
      if (now - timestamp > DISMISS_DURATION) {
        return true;
      }
      
      // Same version and within 24 hours, don't show
      return false;
    } catch (e) {
      return true; // If parsing fails, show it
    }
  }, []);

  // Check version from server
  const checkVersion = useCallback(async () => {
    try {
      const response = await fetch('/version.json?t=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const serverVersion = data.version;
        
        // Only show if:
        // 1. Server version is different from current build
        // 2. We should show based on dismiss logic (24h rule)
        if (serverVersion && 
            serverVersion !== currentVersion && 
            serverVersion !== BUILD_VERSION &&
            shouldShowNotification(serverVersion)) {
          console.log('[Version] New version available:', serverVersion);
          setNewVersion(serverVersion);
          setUpdateAvailable(true);
        }
      }
    } catch (error) {
      // Silently fail - version check is not critical
      console.log('[Version] Check failed:', error.message);
    }
  }, [currentVersion, shouldShowNotification]);

  // Initialize version checking
  useEffect(() => {
    // Set up service worker update callback
    setUpdateCallback(() => {
      console.log('[Version] Service worker update detected');
      // Only show if 24h rule allows
      const dismissData = localStorage.getItem('dogefood_update_dismissed');
      if (!dismissData) {
        setUpdateAvailable(true);
        return;
      }
      try {
        const { timestamp } = JSON.parse(dismissData);
        if (Date.now() - timestamp > DISMISS_DURATION) {
          setUpdateAvailable(true);
        }
      } catch (e) {
        setUpdateAvailable(true);
      }
    });

    // Check version on mount (with slight delay to not block initial render)
    const initialCheck = setTimeout(checkVersion, 5000);

    // Check version every 5 minutes (not too aggressive)
    checkIntervalRef.current = setInterval(checkVersion, 5 * 60 * 1000);

    // Also check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
        checkForUpdates();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialCheck);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersion]);

  // Handle update action
  const applyUpdate = useCallback(() => {
    // Clear dismiss data since user is updating
    localStorage.removeItem('dogefood_update_dismissed');
    
    // Tell service worker to skip waiting
    skipWaiting();
    
    // Reload the page to get new content
    window.location.reload();
  }, []);

  // Dismiss update notification - stores version and timestamp
  const dismissUpdate = useCallback(() => {
    // Store what version was dismissed and when
    if (newVersion) {
      localStorage.setItem('dogefood_update_dismissed', JSON.stringify({
        version: newVersion,
        timestamp: Date.now()
      }));
    }
    setUpdateAvailable(false);
  }, [newVersion]);

  const value = {
    updateAvailable,
    currentVersion,
    newVersion,
    applyUpdate,
    dismissUpdate,
    checkVersion
  };

  return (
    <VersionContext.Provider value={value}>
      {children}
    </VersionContext.Provider>
  );
};

export const useVersion = () => {
  const context = useContext(VersionContext);
  if (!context) {
    return {
      updateAvailable: false,
      currentVersion: BUILD_VERSION,
      newVersion: null,
      applyUpdate: () => window.location.reload(),
      dismissUpdate: () => {},
      checkVersion: () => {}
    };
  }
  return context;
};

export default VersionContext;

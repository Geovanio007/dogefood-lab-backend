import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { setUpdateCallback, skipWaiting, checkForUpdates } from '../serviceWorkerRegistration';

const VersionContext = createContext(null);

// Generate build version from timestamp
const BUILD_VERSION = process.env.REACT_APP_VERSION || Date.now().toString(36);

export const VersionProvider = ({ children }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(BUILD_VERSION);
  const [newVersion, setNewVersion] = useState(null);
  const checkIntervalRef = useRef(null);

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
        
        // Compare versions
        if (serverVersion && serverVersion !== currentVersion && serverVersion !== BUILD_VERSION) {
          console.log('[Version] New version available:', serverVersion);
          setNewVersion(serverVersion);
          setUpdateAvailable(true);
        }
      }
    } catch (error) {
      // Silently fail - version check is not critical
      console.log('[Version] Check failed:', error.message);
    }
  }, [currentVersion]);

  // Initialize version checking
  useEffect(() => {
    // Set up service worker update callback
    setUpdateCallback(() => {
      console.log('[Version] Service worker update detected');
      setUpdateAvailable(true);
    });

    // Check version on mount
    checkVersion();

    // Check version every 2 minutes
    checkIntervalRef.current = setInterval(checkVersion, 2 * 60 * 1000);

    // Also check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
        checkForUpdates();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersion]);

  // Handle update action
  const applyUpdate = useCallback(() => {
    // Tell service worker to skip waiting
    skipWaiting();
    
    // Reload the page to get new content
    window.location.reload();
  }, []);

  // Dismiss update notification
  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

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

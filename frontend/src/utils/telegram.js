import WebApp from '@twa-dev/sdk';

// Initialize Telegram WebApp
export const initTelegramWebApp = () => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    WebApp.ready();
    return true;
  }
  return false;
};

// Check if running inside Telegram
export const isTelegramWebApp = () => {
  return typeof window !== 'undefined' && 
         window.Telegram?.WebApp?.initData !== undefined;
};

// Get Telegram user data
export const getTelegramUser = () => {
  if (!isTelegramWebApp()) return null;
  
  try {
    const webApp = window.Telegram.WebApp;
    return webApp.initDataUnsafe?.user || null;
  } catch (error) {
    console.error('Error getting Telegram user:', error);
    return null;
  }
};

// Get Telegram init data for authentication
export const getTelegramInitData = () => {
  if (!isTelegramWebApp()) return null;
  
  try {
    return window.Telegram.WebApp.initData;
  } catch (error) {
    console.error('Error getting Telegram init data:', error);
    return null;
  }
};

// Update viewport height CSS variable
const updateViewportHeight = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const webApp = window.Telegram?.WebApp;
    const viewportHeight = webApp?.viewportStableHeight || webApp?.viewportHeight || window.innerHeight;
    
    // Set CSS custom property for viewport height
    document.documentElement.style.setProperty('--tg-viewport-height', `${viewportHeight}px`);
    document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
    
    // Also set body height
    document.body.style.height = `${viewportHeight}px`;
    document.body.style.minHeight = `${viewportHeight}px`;
    document.body.style.maxHeight = `${viewportHeight}px`;
    
    console.log(`📐 Viewport height set to: ${viewportHeight}px`);
  } catch (error) {
    console.error('Error updating viewport height:', error);
  }
};

// Expand Telegram WebApp to full height and optimize viewport
export const expandTelegramWebApp = () => {
  if (isTelegramWebApp()) {
    try {
      const webApp = window.Telegram.WebApp;
      
      // Expand to full height
      webApp.expand();
      
      // Enable closing confirmation
      webApp.enableClosingConfirmation();
      
      // Set proper viewport for mobile
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
      }
      
      // Add telegram-webapp class to body and html for styling
      document.body.classList.add('telegram-webapp');
      document.documentElement.classList.add('telegram-webapp');
      
      // Optimize for mobile touch
      document.body.style.touchAction = 'manipulation';
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      
      // Handle safe areas for notched devices
      document.body.style.paddingTop = 'env(safe-area-inset-top)';
      document.body.style.paddingBottom = 'env(safe-area-inset-bottom)';
      document.body.style.paddingLeft = 'env(safe-area-inset-left)';
      document.body.style.paddingRight = 'env(safe-area-inset-right)';
      
      // Initial viewport height update
      updateViewportHeight();
      
      // Listen for viewport changes
      webApp.onEvent('viewportChanged', ({ isStateStable }) => {
        if (isStateStable) {
          updateViewportHeight();
        }
      });
      
      // Also listen to window resize for fallback
      window.addEventListener('resize', () => {
        setTimeout(updateViewportHeight, 100);
      });
      
      console.log('✅ Telegram WebApp expanded and optimized for mobile');
    } catch (error) {
      console.error('Error expanding Telegram WebApp:', error);
    }
  }
};

// Set Telegram WebApp header color
export const setTelegramHeaderColor = (color = '#1f2937') => {
  if (isTelegramWebApp()) {
    try {
      window.Telegram.WebApp.setHeaderColor(color);
    } catch (error) {
      console.error('Error setting Telegram header color:', error);
    }
  }
};

// Show Telegram WebApp main button
export const showTelegramMainButton = (text, onClick) => {
  if (isTelegramWebApp()) {
    try {
      const webApp = window.Telegram.WebApp;
      webApp.MainButton.text = text;
      webApp.MainButton.show();
      webApp.MainButton.onClick(onClick);
    } catch (error) {
      console.error('Error showing Telegram main button:', error);
    }
  }
};

// Hide Telegram WebApp main button
export const hideTelegramMainButton = () => {
  if (isTelegramWebApp()) {
    try {
      window.Telegram.WebApp.MainButton.hide();
    } catch (error) {
      console.error('Error hiding Telegram main button:', error);
    }
  }
};

// Show Telegram WebApp popup
export const showTelegramPopup = (title, message, buttons = []) => {
  if (isTelegramWebApp()) {
    try {
      window.Telegram.WebApp.showPopup({
        title,
        message,
        buttons
      });
    } catch (error) {
      console.error('Error showing Telegram popup:', error);
    }
  }
};

// Close Telegram WebApp
export const closeTelegramWebApp = () => {
  if (isTelegramWebApp()) {
    try {
      window.Telegram.WebApp.close();
    } catch (error) {
      console.error('Error closing Telegram WebApp:', error);
    }
  }
};

// Get Telegram theme parameters
export const getTelegramTheme = () => {
  if (!isTelegramWebApp()) return null;
  
  try {
    return window.Telegram.WebApp.themeParams;
  } catch (error) {
    console.error('Error getting Telegram theme:', error);
    return null;
  }
};

// Detect if running on Telegram mobile app
export const isTelegramMobile = () => {
  if (!isTelegramWebApp()) return false;
  
  try {
    const webApp = window.Telegram.WebApp;
    const platform = webApp.platform;
    return platform === 'ios' || platform === 'android' || 
           window.innerWidth <= 768 || 
           /Mobi|Android/i.test(navigator.userAgent);
  } catch (error) {
    console.error('Error detecting Telegram mobile:', error);
    return window.innerWidth <= 768;
  }
};

// Get viewport dimensions
export const getTelegramViewport = () => {
  if (!isTelegramWebApp()) {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      isExpanded: true,
      isStable: true
    };
  }
  
  try {
    const webApp = window.Telegram.WebApp;
    return {
      width: window.innerWidth,
      height: webApp.viewportHeight || window.innerHeight,
      stableHeight: webApp.viewportStableHeight || window.innerHeight,
      isExpanded: webApp.isExpanded,
      isStable: true
    };
  } catch (error) {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      isExpanded: true,
      isStable: true
    };
  }
};

// Optimize for Telegram platform
export const optimizeForTelegramPlatform = () => {
  if (!isTelegramWebApp()) return;
  
  try {
    const webApp = window.Telegram.WebApp;
    const isMobile = isTelegramMobile();
    
    if (isMobile) {
      // Mobile-specific optimizations
      document.body.style.fontSize = '16px';
      document.documentElement.style.fontSize = '16px';
      
      // Add mobile-specific class
      document.body.classList.add('telegram-mobile');
      
      // Disable pull-to-refresh on mobile
      document.body.style.overscrollBehavior = 'none';
      
      // Prevent bounce effect on iOS
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = '0';
      document.body.style.left = '0';
      
      console.log('📱 Optimized for Telegram mobile');
    } else {
      // Desktop-specific optimizations
      document.body.classList.add('telegram-desktop');
      console.log('🖥️ Optimized for Telegram desktop');
    }
    
    // Set theme colors based on Telegram theme
    const themeParams = getTelegramTheme();
    if (themeParams) {
      // Apply Telegram theme colors
      const root = document.documentElement;
      if (themeParams.bg_color) {
        root.style.setProperty('--tg-bg-color', themeParams.bg_color);
      }
      if (themeParams.text_color) {
        root.style.setProperty('--tg-text-color', themeParams.text_color);
      }
      if (themeParams.button_color) {
        root.style.setProperty('--tg-button-color', themeParams.button_color);
      }
      if (themeParams.hint_color) {
        root.style.setProperty('--tg-hint-color', themeParams.hint_color);
      }
    }
    
  } catch (error) {
    console.error('Error optimizing for Telegram platform:', error);
  }
};
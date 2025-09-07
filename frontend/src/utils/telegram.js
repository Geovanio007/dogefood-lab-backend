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

// Expand Telegram WebApp to full height
export const expandTelegramWebApp = () => {
  if (isTelegramWebApp()) {
    try {
      window.Telegram.WebApp.expand();
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
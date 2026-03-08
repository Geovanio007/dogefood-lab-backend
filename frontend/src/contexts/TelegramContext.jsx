import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  isTelegramWebApp, 
  getTelegramUser, 
  getTelegramInitData, 
  initTelegramWebApp,
  expandTelegramWebApp,
  setTelegramHeaderColor,
  optimizeForTelegramPlatform,
  installTelegramWalletDeepLinkBridge,
  isTelegramMobile
} from '../utils/telegram';

const TelegramContext = createContext();

export const useTelegram = () => {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }
  return context;
};

export const TelegramProvider = ({ children }) => {
  const [isTelegram, setIsTelegram] = useState(false);
  const [telegramUser, setTelegramUser] = useState(null);
  const [initData, setInitData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initializeTelegram = async () => {
      setIsLoading(true);
      
      try {
        // Check if running in Telegram
        const telegramDetected = isTelegramWebApp();
        setIsTelegram(telegramDetected);

        if (telegramDetected) {
          console.log('🤖 Telegram WebApp detected');
          
          // Initialize Telegram WebApp
          initTelegramWebApp();
          
          // Get user data
          const user = getTelegramUser();
          const initDataStr = getTelegramInitData();
          
          console.log('👤 Telegram user:', user);
          
          setTelegramUser(user);
          setInitData(initDataStr);
          setIsAuthenticated(!!user && !!initDataStr);
          
          // Configure Telegram WebApp
          expandTelegramWebApp();
          setTelegramHeaderColor('#1f2937'); // Dark header for game theme
          optimizeForTelegramPlatform(); // Platform-specific optimizations
          installTelegramWalletDeepLinkBridge();
          
          console.log('✅ Telegram WebApp initialized and optimized');
        } else {
          console.log('🌐 Running in regular browser');
        }
      } catch (error) {
        console.error('❌ Error initializing Telegram:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeTelegram();
  }, []);

  const registerTelegramUser = async () => {
    if (!initData || !telegramUser) {
      throw new Error('No Telegram authentication data available');
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/players/telegram-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData: initData
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Registration failed: ${error}`);
      }

      const result = await response.json();
      console.log('✅ Telegram user registered:', result);
      return result;
    } catch (error) {
      console.error('❌ Telegram registration error:', error);
      throw error;
    }
  };

  const linkWallet = async (walletAddress, signature, message) => {
    if (!initData || !telegramUser) {
      throw new Error('No Telegram authentication data available');
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/players/link-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData: initData,
          address: walletAddress,
          signature: signature,
          message: message
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Wallet linking failed: ${error}`);
      }

      const result = await response.json();
      console.log('✅ Wallet linked:', result);
      return result;
    } catch (error) {
      console.error('❌ Wallet linking error:', error);
      throw error;
    }
  };

  const value = {
    isTelegram,
    telegramUser,
    initData,
    isLoading,
    isAuthenticated,
    registerTelegramUser,
    linkWallet
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
};
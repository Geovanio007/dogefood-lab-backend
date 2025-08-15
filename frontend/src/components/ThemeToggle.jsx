import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = ({ className = "" }) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle relative inline-flex items-center justify-center p-3 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${className}`}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Background with gradient */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 opacity-90 transition-all duration-300"></div>
      
      {/* Icon */}
      <div className="relative z-10 flex items-center justify-center">
        {isDarkMode ? (
          <Sun className="w-6 h-6 text-white drop-shadow-lg transition-transform duration-300 rotate-0 scale-100" />
        ) : (
          <Moon className="w-6 h-6 text-white drop-shadow-lg transition-transform duration-300 rotate-0 scale-100" />
        )}
      </div>
      
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 opacity-30 blur-lg scale-150 transition-all duration-300"></div>
    </button>
  );
};

export default ThemeToggle;
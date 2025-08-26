import React, { useState, useEffect } from 'react';
import { UserSettings } from '../../core/game/UserSettings';

const DarkModeButton: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const userSettings = new UserSettings();

  useEffect(() => {
    // Initialize dark mode state
    const darkMode = userSettings.darkMode();
    setIsDarkMode(darkMode);
    
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    // Toggle using UserSettings which handles DOM classes
    userSettings.toggleDarkMode();
    
    const newDarkMode = userSettings.darkMode();
    setIsDarkMode(newDarkMode);
    
    // Dispatch event for other components that might need to know
    const event = new CustomEvent('dark-mode-changed', {
      detail: { isDarkMode: newDarkMode },
    });
    document.dispatchEvent(event);
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full bg-white/80 dark:bg-gray-800/80 
                 border border-gray-300 dark:border-gray-600 shadow-lg hover:shadow-xl 
                 transition-all duration-200 flex items-center justify-center backdrop-blur-sm"
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDarkMode ? (
        // Sun icon for light mode
        <svg 
          className="w-6 h-6 text-yellow-500" 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path 
            fillRule="evenodd" 
            // eslint-disable-next-line max-len
            d={`M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0z
              m-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414z
              m2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0z
              M17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z
              M5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707z
              m1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414z
              M4 11a1 1 0 100-2H3a1 1 0 000 2h1z`} 
            clipRule="evenodd" 
          />
        </svg>
      ) : (
        // Moon icon for dark mode
        <svg 
          className="w-6 h-6 text-gray-700" 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path 
            d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" 
          />
        </svg>
      )}
    </button>
  );
};

export default DarkModeButton;
import React, { useState, useEffect } from 'react';

import {
  MAX_USERNAME_LENGTH,
  validateUsername,
} from '../../core/validations/username';
import { UserSettings } from '../../core/game/UserSettings';
import { translateText } from '../Utils';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  className?: string;
}

const UsernameInput: React.FC<UsernameInputProps> = ({
  value,
  onChange,
  onValidationChange,
  className = '',
}) => {
  const [validationError, setValidationError] = useState('');
  const userSettings = new UserSettings();

  useEffect(() => {
    // Load stored username on mount
    const storedUsername = getStoredUsername();
    if (storedUsername && !value) {
      onChange(storedUsername);
    }
  }, []);

  useEffect(() => {
    // Validate username whenever it changes
    const validation = validateUsername(value);
    const isValid = validation.isValid;
    
    if (!isValid && value.length > 0) {
      setValidationError(validation.error ?? 'Invalid username');
    } else {
      setValidationError('');
    }
    
    onValidationChange?.(isValid);
    
    // Store username
    if (isValid && value) {
      localStorage.setItem('username', value);
      dispatchUsernameEvent(value);
    }
  }, [value, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const getStoredUsername = (): string => {
    const stored = localStorage.getItem('username');
    if (stored) return stored;

    // Generate random username
    const adjectives = ['Swift', 'Brave', 'Mighty', 'Noble', 'Fierce'];
    const nouns = ['Warrior', 'Knight', 'Champion', 'Hero', 'Guardian'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    return `${randomAdjective}${randomNoun}${randomNum}`;
  };

  const dispatchUsernameEvent = (username: string) => {
    const event = new CustomEvent('username-changed', {
      detail: { username },
    });
    document.dispatchEvent(event);
  };

  const isValid = (): boolean => {
    return validateUsername(value).isValid;
  };

  return (
    <div className={className}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={translateText('username.enter_username')}
        maxLength={MAX_USERNAME_LENGTH}
        className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm
        text-2xl text-center focus:outline-none focus:ring-2
        focus:ring-blue-500 focus:border-blue-500 dark:border-gray-300/60
        dark:bg-gray-700 dark:text-white"
      />
      {validationError && (
        <div
          id="username-validation-error"
          className="text-red-500 text-sm mt-1 text-center"
        >
          {validationError}
        </div>
      )}
    </div>
  );
};

export default UsernameInput;
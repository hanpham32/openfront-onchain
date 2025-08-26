import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  MAX_USERNAME_LENGTH,
  validateUsername,
} from '../../core/validations/username';
import { UserSettings } from '../../core/game/UserSettings';
import { translateText } from '../Utils';
import { v4 as uuidv4 } from 'uuid';

const usernameKey = 'username';

interface UsernameInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  className?: string;
}

interface UsernameInputRef {
  getCurrentUsername: () => string;
  isValid: () => boolean;
}

const UsernameInput = forwardRef<UsernameInputRef, UsernameInputProps>(({
  value,
  onChange,
  onValidationChange,
  className = '',
}, ref) => {
  const [username, setUsername] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isValidState, setIsValidState] = useState(true);
  const userSettings = new UserSettings();

  const generateNewUsername = useCallback((): string => {
    const uuidToThreeDigits = (): string => {
      const uuid = uuidv4();
      const cleanUuid = uuid.replace(/-/g, '').toLowerCase();
      const decimal = BigInt(`0x${cleanUuid}`);
      const threeDigits = decimal % 1000n;
      return threeDigits.toString().padStart(3, '0');
    };

    const newUsername = 'Anon' + uuidToThreeDigits();
    storeUsername(newUsername);
    return newUsername;
  }, []);

  const getStoredUsername = useCallback((): string => {
    const storedUsername = localStorage.getItem(usernameKey);
    if (storedUsername) {
      return storedUsername;
    }
    return generateNewUsername();
  }, [generateNewUsername]);

  const storeUsername = (usernameToStore: string) => {
    if (usernameToStore) {
      localStorage.setItem(usernameKey, usernameToStore);
    }
  };

  const dispatchUsernameEvent = useCallback((usernameValue: string) => {
    const event = new CustomEvent('username-change', {
      detail: { username: usernameValue },
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }, []);

  // Initialize username on mount
  useEffect(() => {
    const initialUsername = value || getStoredUsername();
    setUsername(initialUsername);
    dispatchUsernameEvent(initialUsername);
  }, []);

  // Update username when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setUsername(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value.trim();
    setUsername(newUsername);
    
    const result = validateUsername(newUsername);
    setIsValidState(result.isValid);
    
    if (result.isValid) {
      storeUsername(newUsername);
      setValidationError('');
      onChange?.(newUsername);
      onValidationChange?.(true);
      dispatchUsernameEvent(newUsername);
    } else {
      setValidationError(result.error ?? '');
      onValidationChange?.(false);
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getCurrentUsername: () => username,
    isValid: () => isValidState,
  }), [username, isValidState]);

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={username}
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
          className="absolute z-10 w-full mt-2 px-3 py-1 text-lg border rounded
            bg-white text-red-600 border-red-600 dark:bg-gray-700
            dark:text-red-300 dark:border-red-300"
        >
          {validationError}
        </div>
      )}
    </div>
  );
});

UsernameInput.displayName = 'UsernameInput';

export default UsernameInput;
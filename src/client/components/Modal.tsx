import React, { useEffect } from 'react';
import { translateText } from '../Utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  translationKey?: string;
  alwaysMaximized?: boolean;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title = '',
  translationKey = '',
  alwaysMaximized = false,
  children
}) => {
  const displayTitle = translationKey ? translateText(translationKey) : title;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`
          bg-gray-800 rounded-lg min-w-[340px] max-w-[860px] border border-gray-600
          ${alwaysMaximized ? 'w-full min-h-[320px] h-[60vh]' : ''}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-black bg-opacity-60 text-white p-4 rounded-t-lg text-lg font-medium border-b border-gray-600">
          <span>{displayTitle}</span>
          <button
            className="absolute right-4 top-4 text-white hover:text-gray-300 text-xl font-bold w-6 h-6 flex items-center justify-center"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="p-4 bg-gray-800 text-white rounded-b-lg max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
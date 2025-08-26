import React from 'react';
import { translateText } from '../Utils';

interface ButtonProps {
  id?: string;
  title?: string;
  translationKey?: string;
  secondary?: boolean;
  block?: boolean;
  blockDesktop?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  id,
  title = '',
  translationKey = '',
  secondary = false,
  block = false,
  blockDesktop = false,
  disabled = false,
  onClick,
  className = '',
}) => {
  const buttonClasses = [
    'c-button',
    block && 'c-button--block',
    blockDesktop && 'c-button--blockDesktop',
    secondary && 'c-button--secondary',
    disabled && 'c-button--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const buttonText = translationKey ? translateText(translationKey) : title;

  return (
    <button
      id={id}
      className={buttonClasses}
      disabled={disabled}
      onClick={onClick}
    >
      {buttonText}
    </button>
  );
};

export default Button;
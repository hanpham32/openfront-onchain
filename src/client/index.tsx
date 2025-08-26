import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

// Remove preload class when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (!container) {
    console.error('Root container not found');
    return;
  }

  const root = createRoot(container);
  root.render(<App />);

  // Remove preload class after React app is rendered
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('preload');
  });
});
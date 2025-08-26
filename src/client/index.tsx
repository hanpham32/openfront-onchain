import React from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';

import App from './App';

// Remove preload class when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (!container) {
    console.error('Root container not found');
    return;
  }

  const root = createRoot(container);
  root.render(
    <PrivyProvider
      appId={process.env.PRIVY_APP_ID || "cmen5yg3g00lnjm0bzlafhjbs"}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
        },
      }}
    >
      <App />
    </PrivyProvider>
  );

  // Remove preload class after React app is rendered
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('preload');
  });
});
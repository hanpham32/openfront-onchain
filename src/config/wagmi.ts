import { createConfig, http } from 'wagmi';
import { baseSepolia, localhost } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [localhost, baseSepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.WALLETCONNECT_PROJECT_ID || '',
    }),
  ],
  transports: {
    [localhost.id]: http('http://127.0.0.1:8545'),
    [baseSepolia.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
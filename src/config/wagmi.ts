import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { baseSepolia, localhost } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [localhost, baseSepolia],
  transports: {
    [localhost.id]: http("http://127.0.0.1:8545"),
    [baseSepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

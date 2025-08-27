import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { wagmiConfig } from "../config/wagmi";
import App from "./App";

const queryClient = new QueryClient();

// Remove preload class when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("root");
  if (!container) {
    console.error("Root container not found");
    return;
  }

  const root = createRoot(container);
  root.render(
    <html>
      <body>
        <PrivyProvider
          appId={process.env.PRIVY_APP_ID ?? "cmen5yg3g00lnjm0bzlafhjbs"}
          config={{
            loginMethods: ["email", "wallet"],
            appearance: {
              theme: "dark",
              accentColor: "#676FFF",
            },
          }}
        >
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig}>
              <App />
            </WagmiProvider>
          </QueryClientProvider>
        </PrivyProvider>
      </body>
    </html>,
  );

  // Remove preload class after React app is rendered
  requestAnimationFrame(() => {
    document.documentElement.classList.remove("preload");
  });
});

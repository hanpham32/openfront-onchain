import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
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
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
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
              <App />
            </PrivyProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>,
  );

  // Remove preload class after React app is rendered
  requestAnimationFrame(() => {
    document.documentElement.classList.remove("preload");
  });
});

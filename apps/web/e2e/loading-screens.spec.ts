import { defineLoadingScreenTests } from "@auction/ui/e2e/loading-check";
import { expect, test } from "@playwright/test";

// Bid's public loading screens (docs/design/motion.md, MO12), against the seeded stack. Opt-in
// locally; CI's browser gates run it.
// PLAYWRIGHT_LOADING_CHECK=1 pnpm --filter @auction/web exec playwright test e2e/loading-screens.spec.ts --no-deps
test.describe("bid loading screens @optin", () => {
  defineLoadingScreenTests(test, expect, "bid", [
    { name: "home", from: "/terms", to: "/" },
    {
      name: "sales",
      from: "/terms",
      to: "/sales",
      swapNotAsserted:
        "While a sale is live, /sales answers with a server redirect to its live tab; the router follows it with a blank frame before the page (the same on main, 1.42 at 1440). That is the redirect, not this loading screen; listed as a follow-up on the motion loading PR.",
    },
    { name: "results", from: "/terms", to: "/results" },
    { name: "artists", from: "/terms", to: "/artists" },
    { name: "press", from: "/terms", to: "/press" },
    { name: "search", from: "/terms", to: "/search" },
    { name: "about", from: "/terms", to: "/about" },
  ]);
});

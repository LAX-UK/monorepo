import { expect, test } from "@playwright/test";
import { describeLoadingScreens } from "./helpers/loading-check";

// Bid's public loading screens (docs/design/motion.md, MO12). Opt-in: needs Bid running.
// PLAYWRIGHT_LOADING_CHECK=1 pnpm --filter @auction/web exec playwright test e2e/loading-screens.spec.ts --no-deps
describeLoadingScreens(test, expect, "bid", [
  { name: "home", from: "/terms", to: "/" },
  { name: "sales", from: "/terms", to: "/sales" },
  { name: "results", from: "/terms", to: "/results" },
  { name: "artists", from: "/terms", to: "/artists" },
  { name: "press", from: "/terms", to: "/press" },
  { name: "search", from: "/terms", to: "/search" },
  { name: "about", from: "/terms", to: "/about" },
]);

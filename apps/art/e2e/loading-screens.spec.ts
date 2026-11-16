import { expect, test } from "@playwright/test";
import { describeLoadingScreens } from "../../web/e2e/helpers/loading-check";

// lax.art's loading screens (docs/design/motion.md, MO12). Opt-in: needs lax.art running.
// PLAYWRIGHT_LOADING_CHECK=1 pnpm --filter @auction/art exec playwright test e2e/loading-screens.spec.ts
describeLoadingScreens(test, expect, "art", [
  { name: "home", from: "/visit", to: "/" },
  { name: "art-hub", from: "/", to: "/art-hub" },
  { name: "collector-hub", from: "/", to: "/collector-hub" },
  { name: "visit", from: "/", to: "/visit" },
  { name: "how-to-buy", from: "/", to: "/how-to-buy" },
]);

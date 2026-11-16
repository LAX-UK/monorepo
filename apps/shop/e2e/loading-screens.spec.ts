import { expect, test } from "@playwright/test";
import { describeLoadingScreens } from "../../web/e2e/helpers/loading-check";

// Shop's loading screens (docs/design/motion.md, MO12). Opt-in: needs Shop running.
// PLAYWRIGHT_LOADING_CHECK=1 pnpm --filter @auction/shop exec playwright test e2e/loading-screens.spec.ts
describeLoadingScreens(test, expect, "shop", [
  { name: "artworks", from: "/", to: "/artworks" },
  { name: "artists", from: "/", to: "/artists" },
  { name: "categories", from: "/", to: "/categories" },
  { name: "basket", from: "/", to: "/basket" },
]);

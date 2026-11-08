export const shopE2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
export const shopE2eSkipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3020), and start Shop (pnpm --filter @auction/shop dev).";

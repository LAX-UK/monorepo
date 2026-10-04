import { describe, expect, it } from "vitest";
import { buildShopApiSchedulerTasks } from "./create-shop-api-scheduler.js";

const baseEnv = {
  SHOP_SCHEDULER_ENABLED: true,
  SHOP_SCHEDULER_INTERVAL_MS: 60_000,
  SHOP_STOREFRONT_URL: "http://localhost:3020",
  SHOP_FAKE_CHECKOUT_ENABLED: false,
  SHOP_PAYOUTS_ENABLED: false,
  SHOP_THIRD_PARTY_ENABLED: false,
} as const;

describe("createShopApiScheduler", () => {
  it("omits phase 2+ tasks when payout and third-party flags are off", () => {
    const taskNames = buildShopApiSchedulerTasks({
      db: {} as never,
      env: baseEnv as never,
    }).map((task) => task.name);
    expect(taskNames).toContain("stale-checkout-reaper");
    expect(taskNames).toContain("identity-merge");
    expect(taskNames).toContain("notify-me-dispatch");
    expect(taskNames).not.toContain("payout-eligibility");
    expect(taskNames).not.toContain("stock-hold-expiry");
  });
});

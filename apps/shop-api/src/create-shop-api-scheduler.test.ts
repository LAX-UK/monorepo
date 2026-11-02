import { describe, expect, it } from "vitest";
import { buildShopApiSchedulerTasks } from "./create-shop-api-scheduler.js";

const baseEnv = {
  SHOP_SCHEDULER_ENABLED: true,
  SHOP_SCHEDULER_INTERVAL_MS: 60_000,
  SHOP_STOREFRONT_URL: "http://localhost:3020",
  SHOP_FAKE_CHECKOUT_ENABLED: false,
  SHOP_PAYOUTS_ENABLED: false,
  SHOP_THIRD_PARTY_ENABLED: false,
  SHOP_CONNECT_TRANSFERS_ENABLED: false,
  STRIPE_SHOP_CONNECT_PLATFORM_KEY: "bid_sandbox",
  DOMAIN_EVENT_PUBLISH_VALIDATE: "observe",
} as const;

function taskNames(env: Record<string, unknown>): string[] {
  return buildShopApiSchedulerTasks({
    db: {} as never,
    env: env as never,
    log: {} as never,
  }).map((task) => task.name);
}

describe("createShopApiScheduler", () => {
  it("omits phase 2+ tasks when payout and third-party flags are off", () => {
    const names = taskNames(baseEnv);
    expect(names).toContain("stale-checkout-reaper");
    expect(names).toContain("identity-merge");
    expect(names).toContain("staff-access");
    expect(names).toContain("personal-data-anonymisation");
    expect(names).toContain("notify-me-dispatch");
    expect(names).not.toContain("payout-eligibility");
    expect(names).not.toContain("stock-hold-expiry");
    expect(names).not.toContain("connect-payout-transfer");
  });

  it("schedules Connect transfers only when payouts, transfers and a Stripe key are set", () => {
    const payouts = { ...baseEnv, SHOP_PAYOUTS_ENABLED: true };
    expect(taskNames(payouts)).not.toContain("connect-payout-transfer");
    expect(taskNames({ ...payouts, SHOP_CONNECT_TRANSFERS_ENABLED: true })).not.toContain(
      "connect-payout-transfer",
    );
    expect(
      taskNames({
        ...payouts,
        SHOP_CONNECT_TRANSFERS_ENABLED: true,
        STRIPE_SECRET_KEY: "sk_test_x",
      }),
    ).toContain("connect-payout-transfer");
  });
});

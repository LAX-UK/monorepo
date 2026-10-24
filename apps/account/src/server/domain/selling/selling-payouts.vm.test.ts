import type { PortalPayeeConnectStatus } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildPayoutAccount, buildPayoutsList } from "./selling-payouts.vm";

const status = (overrides: Partial<PortalPayeeConnectStatus>): PortalPayeeConnectStatus => ({
  stripeAccountId: "acct_example",
  chargesEnabled: true,
  payoutsEnabled: true,
  requirementsCurrentlyDue: [],
  disabledReason: null,
  ready: true,
  ...overrides,
});
const config = { publishableKey: "pk_test_example", connectConfigured: true };

describe("buildPayoutAccount", () => {
  it("names each setup stage plainly, with the action that moves it on", () => {
    const notSetUp = buildPayoutAccount({ status: status({ stripeAccountId: null }), config });
    expect([notSetUp.statusLabel, notSetUp.action?.label]).toEqual([
      "Not set up",
      "Set up payouts",
    ]);
    const actionNeeded = buildPayoutAccount({ status: status({ ready: false }), config });
    expect([actionNeeded.statusLabel, actionNeeded.tone, actionNeeded.action?.surface]).toEqual([
      "Action needed",
      "warning",
      "onboarding",
    ]);
    const ready = buildPayoutAccount({ status: status({}), config });
    expect([ready.statusLabel, ready.action?.surface]).toEqual(["Ready", "management"]);
  });

  it("offers nothing to open when Stripe is not configured", () => {
    const account = buildPayoutAccount({
      status: status({ stripeAccountId: null }),
      config: { publishableKey: null, connectConfigured: false },
    });
    expect(account.stage).toBe("not_offered");
    expect(account.action).toBeNull();
  });
});

describe("buildPayoutsList", () => {
  it("names each payout by the sale it pays for", () => {
    const payout = {
      payoutId: "44444444-4444-4444-8444-444444444444",
      grossPence: 85_000,
      deductionsPence: 17_000,
      netPence: 68_000,
      status: "due",
      payoutDueAt: "2026-11-02T00:00:00Z",
      paidAt: null,
    };
    const sale = {
      saleId: "55555555-5555-4555-8555-555555555555",
      channel: "direct" as const,
      artworkId: "66666666-6666-4666-8666-666666666666",
      artworkSlug: "harbour-print",
      artworkTitle: "Harbour Print",
      editionNumber: 12,
      soldAt: "2026-10-20T10:00:00Z",
      grossPence: 85_000,
      feesPence: 17_000,
      netPence: 68_000,
      payoutId: payout.payoutId,
      payoutStatus: "due",
    };
    expect(buildPayoutsList([payout], [sale]).rows[0]?.title).toBe("Harbour Print · Edition 12");
    expect(buildPayoutsList([payout], [{ ...sale, editionNumber: null }]).rows[0]?.title).toBe(
      "Harbour Print",
    );
    expect(buildPayoutsList([payout]).rows[0]?.title).toBe("Payout");
  });

  it("totals what was paid apart from what is to come, and leaves cancelled out", () => {
    const list = buildPayoutsList([
      {
        payoutId: "11111111-1111-4111-8111-111111111111",
        grossPence: 10_000,
        deductionsPence: 2_000,
        netPence: 8_000,
        status: "paid",
        payoutDueAt: "2026-09-01T00:00:00Z",
        paidAt: "2026-09-18T00:00:00Z",
      },
      {
        payoutId: "22222222-2222-4222-8222-222222222222",
        grossPence: 5_000,
        deductionsPence: 1_000,
        netPence: 4_000,
        status: "due",
        payoutDueAt: "2026-10-02T00:00:00Z",
        paidAt: null,
      },
      {
        payoutId: "33333333-3333-4333-8333-333333333333",
        grossPence: 3_000,
        deductionsPence: 0,
        netPence: 3_000,
        status: "cancelled",
        payoutDueAt: "2026-08-02T00:00:00Z",
        paidAt: null,
      },
    ]);
    expect(list.totals).toEqual({ paidPence: 8_000, toComePence: 4_000 });
    expect(list.rows.map((row) => row.status.label)).toEqual([
      "Due 2 Oct 2026",
      "Paid 18 Sept 2026",
      "Cancelled",
    ]);
  });
});

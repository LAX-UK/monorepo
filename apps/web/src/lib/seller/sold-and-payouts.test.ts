import type { Payout } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildPayoutDestination, buildPayoutRows } from "./sold-and-payouts.vm";

describe("buildPayoutRows", () => {
  it("shows fees as a deduction and links each statement", () => {
    const [row] = buildPayoutRows(
      [
        {
          id: "p1",
          legalEntityId: "le",
          periodStart: new Date("2026-06-01T00:00:00Z"),
          periodEnd: new Date("2026-06-30T00:00:00Z"),
          grossAmount: "3800",
          platformFee: "456",
          stripeFee: "8.80",
          netAmount: "3335.20",
          currency: "GBP",
          status: "paid",
        } as Payout,
      ],
      "le",
    );
    expect(row).toMatchObject({
      gross: "£3,800.00",
      fees: "-£464.80",
      net: "£3,335.20",
      statementHref: "/legal-entities/le/payouts/p1/statement",
    });
  });
});

describe("buildPayoutDestination", () => {
  it("names what is waiting for the next payout only when there is some", () => {
    expect(
      buildPayoutDestination({
        ready: true,
        preview: { paymentCount: 1, pendingNet: "1722", currency: "GBP" },
      }),
    ).toMatchObject({ ready: true, pending: "£1,722.00" });
    expect(
      buildPayoutDestination({
        ready: false,
        preview: { paymentCount: 0, pendingNet: "0", currency: "GBP" },
      }),
    ).toEqual({ ready: false, pending: null, bank: null, bankFailed: false });
  });

  const account = {
    bankName: "BARCLAYS BANK PLC",
    last4: "0042",
    accountHolderName: "Northbank Gallery Ltd",
    currency: "GBP",
    status: "ready" as const,
  };

  it("names the bank account payouts go to, from the summary only", () => {
    expect(
      buildPayoutDestination({ ready: true, preview: null, account: { state: "ready", account } }),
    ).toMatchObject({ bank: "Barclays Bank PLC ending 0042 · GBP", bankFailed: false });
    expect(
      buildPayoutDestination({
        ready: true,
        preview: null,
        account: { state: "unavailable", account: null },
      }),
    ).toMatchObject({ bank: null, bankFailed: false });
  });

  it("flags a bank account a payout bounced from", () => {
    expect(
      buildPayoutDestination({
        ready: true,
        preview: null,
        account: { state: "ready", account: { ...account, status: "failed" } },
      }).bankFailed,
    ).toBe(true);
  });
});

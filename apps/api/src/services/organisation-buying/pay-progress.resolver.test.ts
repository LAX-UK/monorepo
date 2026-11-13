import type { LivePaymentGroupFacts } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { GroupCheckoutStatus } from "../payment-group/payment-group-ports.js";
import {
  PayProgressResolver,
  firstProgressOf,
  singleTransferProgressOf,
} from "./pay-progress.resolver.js";
import type { PurchaseEntry } from "./purchase-candidate.reader.js";

function group(overrides: Partial<LivePaymentGroupFacts> = {}): LivePaymentGroupFacts {
  return {
    id: "group-1",
    status: "open",
    checkoutRail: "card",
    stripeCheckoutSessionId: "cs_1",
    totalAmount: "11701.00",
    amountReceived: "0.00",
    memberCount: 2,
    ...overrides,
  };
}

const lot = (lotId: string) => ({
  lotId,
  title: `Work ${lotId}`,
  lotNumber: 1,
  saleTitle: "Autumn",
  totalPence: 100,
});

function resolverWith(status: GroupCheckoutStatus | Error) {
  const checkoutStatus = vi.fn(async () => {
    if (status instanceof Error) throw status;
    return status;
  });
  return { resolver: new PayProgressResolver({ checkoutStatus }), checkoutStatus };
}

describe("PayProgressResolver", () => {
  it("has nothing for lots in no group", async () => {
    const { resolver, checkoutStatus } = resolverWith("open");
    expect((await resolver.resolve([])).size).toBe(0);
    expect(checkoutStatus).not.toHaveBeenCalled();
  });

  it("an open checkout the payer has not finished is not a payment under way", async () => {
    const { resolver } = resolverWith("open");
    const result = await resolver.resolve([{ lot: lot("a"), group: group() }]);
    expect(result.get("group-1")).toBeNull();
  });

  it("a checkout whose time ran out is not a payment under way either", async () => {
    const { resolver } = resolverWith("expired");
    expect((await resolver.resolve([{ lot: lot("a"), group: group() }])).get("group-1")).toBeNull();
  });

  it("a finished card checkout is being confirmed, with the lots of the link it covers", async () => {
    const { resolver } = resolverWith("complete");
    const result = await resolver.resolve([
      { lot: lot("a"), group: group() },
      { lot: lot("b"), group: group() },
    ]);
    expect(result.get("group-1")).toMatchObject({
      rail: "card",
      stage: "confirming",
      lots: [lot("a"), lot("b")],
      totalPence: 1_170_100,
    });
  });

  it("a chosen bank transfer waits for its money, and shows what has arrived once part has", async () => {
    const { resolver } = resolverWith("complete");
    const waiting = await resolver.resolve([
      { lot: lot("a"), group: group({ checkoutRail: "gb_bank_transfer" }) },
    ]);
    expect(waiting.get("group-1")).toMatchObject({ stage: "awaiting_transfer", receivedPence: 0 });

    const part = await resolver.resolve([
      {
        lot: lot("a"),
        group: group({
          checkoutRail: "gb_bank_transfer",
          status: "processing",
          amountReceived: "6000.00",
        }),
      },
    ]);
    expect(part.get("group-1")).toMatchObject({
      stage: "part_received",
      receivedPence: 600_000,
      remainingPence: 570_100,
      receivedPercent: 51,
    });
  });

  it("does not ask the provider about money already on its way", async () => {
    const { resolver, checkoutStatus } = resolverWith("open");
    const result = await resolver.resolve([
      { lot: lot("a"), group: group({ status: "processing", checkoutRail: "gb_bank_transfer" }) },
    ]);
    expect(result.get("group-1")).not.toBeNull();
    expect(checkoutStatus).not.toHaveBeenCalled();
  });

  it("asks once per group, however many lots it holds", async () => {
    const { resolver, checkoutStatus } = resolverWith("open");
    await resolver.resolve([
      { lot: lot("a"), group: group() },
      { lot: lot("b"), group: group() },
    ]);
    expect(checkoutStatus).toHaveBeenCalledTimes(1);
  });

  it("holds the payment when the provider cannot be asked, never offering it again on a guess", async () => {
    const { resolver } = resolverWith(new Error("network"));
    const result = await resolver.resolve([{ lot: lot("a"), group: group() }]);
    expect(result.get("group-1")).toMatchObject({ stage: "confirming" });
  });

  it("a group with no checkout recorded cannot be a payment under way", async () => {
    const { resolver, checkoutStatus } = resolverWith("complete");
    const result = await resolver.resolve([
      { lot: lot("a"), group: group({ stripeCheckoutSessionId: null }) },
    ]);
    expect(result.get("group-1")).toBeNull();
    expect(checkoutStatus).not.toHaveBeenCalled();
  });
});

/** A picked lot whose invoice is paid on its own (no group), as the candidate reader gives it. */
function singleEntry(
  lotId: string,
  payment: { status: "pending" | "authorized" | "captured"; amount: string; received?: number },
  inGroup: LivePaymentGroupFacts | null = null,
): PurchaseEntry {
  return {
    lotId,
    row: {
      lotId,
      buyerAccountKind: "individual",
      lotTitle: `Work ${lotId}`,
      lotNumber: 7,
      saleTitle: "Autumn",
      saleId: "sale-1",
      hammerPrice: "1000.00",
      wonBy: null,
      wonAt: new Date("2026-11-01T10:00:00Z"),
      payment: {
        id: `pay-${lotId}`,
        status: payment.status,
        amount: payment.amount,
        raisedAt: new Date("2026-11-01T10:00:00Z"),
        dueAt: null,
        transferReceivedPence: payment.received,
      },
      fulfilment: null,
    } as PurchaseEntry["row"],
    view: null,
    flags: { heldForReview: false, inPaymentInProgress: false, group: inGroup },
  };
}

describe("a single invoice's own bank transfer", () => {
  it("shows what has arrived on a part-paid transfer: £400 of £1,250", () => {
    const progress = singleTransferProgressOf(
      singleEntry("a", { status: "authorized", amount: "1250.00", received: 40_000 }),
    );
    expect(progress).toEqual({
      rail: "bank_transfer",
      stage: "part_received",
      lots: [
        { lotId: "a", title: "Work a", lotNumber: 7, saleTitle: "Autumn", totalPence: 125_000 },
      ],
      otherInvoices: 0,
      totalPence: 125_000,
      receivedPence: 40_000,
      remainingPence: 85_000,
      receivedPercent: 32,
    });
  });

  it("never reads as more than the invoice, and a penny short is not 100%", () => {
    expect(
      singleTransferProgressOf(
        singleEntry("a", { status: "authorized", amount: "100.00", received: 9_999 }),
      ),
    ).toMatchObject({ receivedPence: 9_999, remainingPence: 1, receivedPercent: 99 });
    expect(
      singleTransferProgressOf(
        singleEntry("a", { status: "authorized", amount: "100.00", received: 12_000 }),
      ),
    ).toMatchObject({ receivedPence: 10_000, remainingPence: 0, receivedPercent: 100 });
  });

  it("shows nothing when nothing is recorded as received, or the invoice is not waiting for a transfer", () => {
    expect(
      singleTransferProgressOf(singleEntry("a", { status: "authorized", amount: "100.00" })),
    ).toBeNull();
    expect(
      singleTransferProgressOf(
        singleEntry("a", { status: "authorized", amount: "100.00", received: 0 }),
      ),
    ).toBeNull();
    expect(
      singleTransferProgressOf(
        singleEntry("a", { status: "pending", amount: "100.00", received: 5_000 }),
      ),
    ).toBeNull();
    expect(
      singleTransferProgressOf(
        singleEntry("a", { status: "captured", amount: "100.00", received: 5_000 }),
      ),
    ).toBeNull();
  });

  it("leaves an invoice paid through a group to the group's progress", () => {
    const grouped = singleEntry(
      "a",
      { status: "authorized", amount: "100.00", received: 5_000 },
      group({ status: "processing", checkoutRail: "gb_bank_transfer" }),
    );
    expect(singleTransferProgressOf(grouped)).toBeNull();
    expect(firstProgressOf([grouped], new Map([["group-1", null]]))).toBeNull();
  });

  it("the first picked lot with a payment under way wins, group or single", () => {
    const plain = singleEntry("a", { status: "pending", amount: "100.00" });
    const partPaid = singleEntry("b", { status: "authorized", amount: "200.00", received: 5_000 });
    expect(firstProgressOf([plain, partPaid], new Map())).toMatchObject({
      stage: "part_received",
      totalPence: 20_000,
      receivedPence: 5_000,
    });
  });
});

import type { LivePaymentGroupFacts } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { GroupCheckoutStatus } from "../payment-group/payment-group-ports.js";
import { PayProgressResolver } from "./pay-progress.resolver.js";

function group(overrides: Partial<LivePaymentGroupFacts> = {}): LivePaymentGroupFacts {
  return {
    id: "group-1",
    status: "open",
    checkoutRail: "card",
    stripeCheckoutSessionId: "cs_1",
    totalAmount: "11701.00",
    amountReceived: "0.00",
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

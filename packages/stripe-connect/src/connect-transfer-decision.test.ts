import { describe, expect, it, vi } from "vitest";
import {
  type ExistingTransferLike,
  TRANSFER_GROUP_MANDATORY_FROM_UNIX,
  type TransferListParams,
  checkTransferForAdoption,
  connectTransferBlockMessage,
  decideConnectTransfer,
} from "./connect-transfer-decision.js";

const input = {
  transferGroup: "payout:p1",
  payoutId: "p1",
  destinationAccountId: "acct_1",
  amountMinor: 48_000,
  currency: "GBP",
  createdAfterUnix: 1_000,
};

const good = (over: Partial<ExistingTransferLike> = {}): ExistingTransferLike => ({
  id: "tr_ok",
  destination: "acct_1",
  amount: 48_000,
  amount_reversed: 0,
  reversed: false,
  currency: "gbp",
  metadata: { payoutId: "p1" },
  ...over,
});

/** A fake Stripe transfers.list with cursor pagination, a group filter and a created filter. */
function fakeStripe(all: Array<ExistingTransferLike & { group?: string; created?: number }>) {
  const list = vi.fn(async (p: TransferListParams) => {
    let rows = all;
    if (p.transfer_group) rows = rows.filter((t) => t.group === p.transfer_group);
    const gte = p.created?.gte;
    if (gte !== undefined) rows = rows.filter((t) => (t.created ?? gte) >= gte);
    const start = p.starting_after ? rows.findIndex((t) => t.id === p.starting_after) + 1 : 0;
    const data = rows.slice(start, start + p.limit);
    return { data, has_more: start + p.limit < rows.length };
  });
  return { transfers: { list } };
}

const grouped = (t: ExistingTransferLike) => ({ ...t, group: "payout:p1" });

describe("decideConnectTransfer", () => {
  it("adopts exactly one live transfer that matches destination, currency and amount", async () => {
    const stripe = fakeStripe([grouped(good({ destination: { id: "acct_1" } }))]);
    await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({
      kind: "adopt",
      transfer: { id: "tr_ok" },
    });
  });

  it("creates when Stripe holds no transfer at all", async () => {
    const stripe = fakeStripe([]);
    await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({ kind: "create" });
  });

  it("creates when the only transfer is fully reversed", async () => {
    const stripe = fakeStripe([grouped(good({ reversed: true, amount_reversed: 48_000 }))]);
    await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({ kind: "create" });
  });

  it("treats a transfer reversed for its whole amount as reversed even without the flag", async () => {
    const stripe = fakeStripe([grouped(good({ reversed: false, amount_reversed: 48_000 }))]);
    await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({ kind: "create" });
  });

  it.each([
    ["two live transfers", [good({ id: "tr_a" }), good({ id: "tr_b" })], "multiple_live_transfers"],
    ["a wrong amount", [good({ amount: 47_999 })], "amount_mismatch"],
    ["a missing amount", [good({ amount: undefined })], "amount_mismatch"],
    ["a wrong destination", [good({ destination: "acct_2" })], "destination_mismatch"],
    ["a wrong currency", [good({ currency: "usd" })], "currency_mismatch"],
    ["a partial reversal", [good({ amount_reversed: 100 })], "partially_reversed"],
    [
      "another payout's metadata",
      [good({ metadata: { payoutId: "p9" } })],
      "payout_metadata_mismatch",
    ],
  ] as const)("blocks on %s", async (_name, transfers, reason) => {
    const stripe = fakeStripe(transfers.map(grouped));
    const decision = await decideConnectTransfer(stripe, input);
    expect(decision).toMatchObject({ kind: "block", reason });
  });

  it("ignores a reversed transfer beside one live match", async () => {
    const stripe = fakeStripe([
      grouped(good({ id: "tr_rev", reversed: true, amount_reversed: 48_000 })),
      grouped(good({ id: "tr_live" })),
    ]);
    await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({
      kind: "adopt",
      transfer: { id: "tr_live" },
    });
  });

  it("finds the match on the second page", async () => {
    const filler = Array.from({ length: 100 }, (_, i) =>
      grouped(good({ id: `tr_rev_${i}`, reversed: true, amount_reversed: 48_000 })),
    );
    const stripe = fakeStripe([...filler, grouped(good({ id: "tr_page2" }))]);
    await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({
      kind: "adopt",
      transfer: { id: "tr_page2" },
    });
    expect(stripe.transfers.list).toHaveBeenCalledTimes(2);
    expect(stripe.transfers.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ starting_after: "tr_rev_99" }),
    );
  });

  it("blocks when a duplicate hides on the second page", async () => {
    const filler = Array.from({ length: 99 }, (_, i) =>
      grouped(good({ id: `tr_rev_${i}`, reversed: true, amount_reversed: 48_000 })),
    );
    const stripe = fakeStripe([
      ...filler,
      grouped(good({ id: "tr_first" })),
      grouped(good({ id: "tr_dup" })),
    ]);
    await expect(decideConnectTransfer(stripe, input)).resolves.toMatchObject({
      kind: "block",
      reason: "multiple_live_transfers",
      transferIds: ["tr_first", "tr_dup"],
    });
  });

  describe("legacy transfers without a transfer group", () => {
    it("filters the legacy scan to the payout's destination account", async () => {
      const stripe = fakeStripe([]);
      await decideConnectTransfer(stripe, input);
      const legacyCall = stripe.transfers.list.mock.calls
        .map(([p]) => p)
        .find((p) => p.transfer_group === undefined);
      expect(legacyCall).toMatchObject({ destination: "acct_1", created: { gte: 1_000 } });
      const groupCall = stripe.transfers.list.mock.calls[0]?.[0];
      expect(groupCall?.destination).toBeUndefined();
    });

    it("scans when the payout's creation time is unknown", async () => {
      const stripe = fakeStripe([]);
      const { createdAfterUnix: _unused, ...unknownCreation } = input;
      await decideConnectTransfer(stripe, unknownCreation);
      expect(stripe.transfers.list).toHaveBeenCalledTimes(2);
    });

    it("scans a payout created just before transfer groups became mandatory", async () => {
      const stripe = fakeStripe([]);
      await decideConnectTransfer(stripe, {
        ...input,
        createdAfterUnix: TRANSFER_GROUP_MANDATORY_FROM_UNIX - 1,
      });
      expect(stripe.transfers.list).toHaveBeenCalledTimes(2);
    });

    it("skips the scan for a payout created when transfer groups became mandatory", async () => {
      const stripe = fakeStripe([
        { ...good({ id: "tr_legacy" }), created: TRANSFER_GROUP_MANDATORY_FROM_UNIX + 10 },
      ]);
      const decision = await decideConnectTransfer(stripe, {
        ...input,
        createdAfterUnix: TRANSFER_GROUP_MANDATORY_FROM_UNIX,
      });
      expect(decision).toEqual({ kind: "create" });
      expect(stripe.transfers.list).toHaveBeenCalledTimes(1);
      expect(stripe.transfers.list.mock.calls[0]?.[0].transfer_group).toBe("payout:p1");
    });

    it("dates the cutoff at 2026-05-24 UTC", () => {
      expect(new Date(TRANSFER_GROUP_MANDATORY_FROM_UNIX * 1000).toISOString()).toBe(
        "2026-05-24T00:00:00.000Z",
      );
    });

    it("adopts a transfer found only by metadata.payoutId", async () => {
      const stripe = fakeStripe([
        { ...good({ id: "tr_other", metadata: { payoutId: "p2" } }), created: 2_000 },
        { ...good({ id: "tr_legacy" }), created: 2_000 },
      ]);
      await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({
        kind: "adopt",
        transfer: { id: "tr_legacy" },
      });
      expect(stripe.transfers.list).toHaveBeenCalledWith(
        expect.objectContaining({ created: { gte: 1_000 } }),
      );
    });

    it("finds a legacy match on a later page", async () => {
      const filler = Array.from({ length: 100 }, (_, i) => ({
        ...good({ id: `tr_x_${i}`, metadata: { payoutId: "other" } }),
        created: 2_000,
      }));
      const stripe = fakeStripe([...filler, { ...good({ id: "tr_legacy" }), created: 2_000 }]);
      await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({
        kind: "adopt",
        transfer: { id: "tr_legacy" },
      });
    });

    it("blocks a legacy transfer to the wrong destination", async () => {
      const stripe = fakeStripe([
        { ...good({ id: "tr_legacy", destination: "acct_2" }), created: 2_000 },
      ]);
      await expect(decideConnectTransfer(stripe, input)).resolves.toMatchObject({
        kind: "block",
        reason: "destination_mismatch",
      });
    });

    it("skips the legacy scan when the group already holds a live transfer", async () => {
      // The group holds a live transfer, so the legacy scan is skipped: the group is authoritative.
      const stripe = fakeStripe([grouped(good({ id: "tr_g" }))]);
      await decideConnectTransfer(stripe, input);
      expect(stripe.transfers.list).toHaveBeenCalledTimes(1);
    });

    it("creates when neither the group nor the metadata holds a transfer", async () => {
      const stripe = fakeStripe([
        { ...good({ metadata: { payoutId: "p2" } }), created: 2_000 },
        { ...good({ id: "tr_old" }), created: 10 },
      ]);
      await expect(decideConnectTransfer(stripe, input)).resolves.toEqual({ kind: "create" });
    });
  });

  it("blocks instead of guessing when it cannot read every transfer", async () => {
    const list = vi.fn(async () => ({ data: [good({ id: "tr_x" })], has_more: true }));
    const decision = await decideConnectTransfer({ transfers: { list } }, input);
    expect(decision).toMatchObject({ kind: "block", reason: "transfer_listing_incomplete" });
  });

  it("lets a Stripe error out so nothing is created", async () => {
    const list = vi.fn().mockRejectedValue(new Error("stripe down"));
    await expect(decideConnectTransfer({ transfers: { list } }, input)).rejects.toThrow(
      "stripe down",
    );
  });

  it("writes the reason and transfer ids for staff", () => {
    expect(
      connectTransferBlockMessage({
        kind: "block",
        reason: "multiple_live_transfers",
        transferIds: ["tr_a", "tr_b"],
      }),
    ).toBe("transfer_blocked: multiple_live_transfers (tr_a, tr_b)");
  });
});

describe("checkTransferForAdoption", () => {
  const expected = { destinationAccountId: "acct_1", currency: "GBP", amountMinor: 48_000 };

  it("accepts a live transfer to the right account, currency and amount", () => {
    expect(checkTransferForAdoption(good({ destination: { id: "acct_1" } }), expected)).toEqual({
      ok: true,
    });
  });

  it.each([
    ["reversed", { reversed: true }, "transfer_reversed"],
    ["fully reversed by amount", { amount_reversed: 48_000 }, "transfer_reversed"],
    ["partly reversed", { amount_reversed: 100 }, "transfer_reversed"],
    ["another account", { destination: "acct_2" }, "destination_mismatch"],
    ["no destination", { destination: undefined }, "destination_mismatch"],
    ["another currency", { currency: "usd" }, "currency_mismatch"],
    ["a different amount", { amount: 47_999 }, "amount_mismatch"],
    ["no amount", { amount: undefined }, "amount_mismatch"],
  ] as const)("refuses a transfer that is %s", (_name, over, reason) => {
    expect(checkTransferForAdoption(good(over), expected)).toEqual({ ok: false, reason });
  });
});

import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import type { ShopTransactionEffects } from "../../../application/ports/shop-unit-of-work.js";
import { notifySellerReturnClosed } from "./notify-seller-return-closed.js";

/** A db whose successive selects resolve to the given rows, in order. */
function fakeDb(results: unknown[][]): Database {
  const queue = [...results];
  const chain = () => {
    const rows = queue.shift() ?? [];
    const q: Record<string, unknown> = {};
    for (const m of ["from", "innerJoin", "where"]) q[m] = () => q;
    q.limit = () => Promise.resolve(rows);
    return q;
  };
  return { select: () => chain() } as unknown as Database;
}

const input = {
  returnId: "ret-1",
  editionId: "ed-1",
  orderLineId: "line-1",
  sellerPartyId: "party-1",
  listingStatus: "authorised",
} as const;

function effects() {
  const queueReturnClosedSeller = vi.fn(async () => {});
  const tx = {
    session: {},
    notifications: { queueReturnClosedSeller },
  } as unknown as ShopTransactionEffects;
  return { tx, queueReturnClosedSeller };
}

const seller = [{ identitySubjectId: "artist-subject" }];
const edition = [{ title: "Warm Basket", editionNumber: 3, proofNumber: null }];

describe("notifySellerReturnClosed", () => {
  it("queues one email per return, keyed by the return", async () => {
    const { tx, queueReturnClosedSeller } = effects();
    await notifySellerReturnClosed(fakeDb([seller, edition, [{ status: "paid" }]]), tx, input);
    expect(queueReturnClosedSeller).toHaveBeenCalledWith(tx.session, {
      idempotencyKey: "return-closed-seller:ret-1",
      sellerIdentitySubjectId: "artist-subject",
      artworkTitle: "Warm Basket",
      editionLabel: "Edition 3",
      stockOutcome: "back_on_sale",
      payout: "recovered",
    });
  });

  it("reports a written-off print and an unpaid payout", async () => {
    const { tx, queueReturnClosedSeller } = effects();
    await notifySellerReturnClosed(fakeDb([seller, edition, [{ status: "due" }]]), tx, {
      ...input,
      listingStatus: "withdrawn",
    });
    expect(queueReturnClosedSeller).toHaveBeenCalledWith(
      tx.session,
      expect.objectContaining({ stockOutcome: "written_off", payout: "withheld" }),
    );
  });

  it("says no payout was due when the sale has no ledger row", async () => {
    const { tx, queueReturnClosedSeller } = effects();
    await notifySellerReturnClosed(fakeDb([seller, edition, []]), tx, input);
    expect(queueReturnClosedSeller).toHaveBeenCalledWith(
      tx.session,
      expect.objectContaining({ payout: "none" }),
    );
  });

  it("sends nothing to a seller without a sign-in", async () => {
    const { tx, queueReturnClosedSeller } = effects();
    await notifySellerReturnClosed(fakeDb([[{ identitySubjectId: null }]]), tx, input);
    expect(queueReturnClosedSeller).not.toHaveBeenCalled();
  });

  it("passes nothing about the buyer to the publisher", async () => {
    const { tx, queueReturnClosedSeller } = effects();
    await notifySellerReturnClosed(fakeDb([seller, edition, []]), tx, input);
    const sent = queueReturnClosedSeller.mock.calls[0] as unknown as [unknown, object];
    expect(Object.keys(sent[1]).sort()).toEqual([
      "artworkTitle",
      "editionLabel",
      "idempotencyKey",
      "payout",
      "sellerIdentitySubjectId",
      "stockOutcome",
    ]);
  });
});

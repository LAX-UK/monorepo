import type { PlaceBidInput, PlaceBidResult } from "@/lib/data/contracts";
import { type BidSubmission, createBidSubmitter } from "@/lib/lot-page/bid-dialog/bid-submitter";
import { describe, expect, it, vi } from "vitest";

const submission: BidSubmission = {
  lotId: "lot-1",
  mode: "next",
  amount: "7250.00",
  maximum: null,
  seenNextBid: "7250.00",
  idempotencyKey: "key-1",
  scheduled: false,
  legalEntityId: "entity-1",
};

function ports(place: (input: PlaceBidInput) => Promise<PlaceBidResult>) {
  const placeBid = vi.fn(place);
  const schedule = vi.fn(async () => ({ ok: true as const }));
  return {
    placeBid,
    schedule,
    submitter: createBidSubmitter({ bidWriter: { placeBid }, absenteeBidWriter: { schedule } }),
  };
}

const placed = { ok: true, bid: { id: "bid-1", amount: "7250.00" } } as unknown as PlaceBidResult;

describe("createBidSubmitter", () => {
  it("sends the next bid with the amount seen and the key", async () => {
    const { submitter, placeBid } = ports(async () => placed);
    const outcome = await submitter.submit(submission);
    expect(outcome.ok).toBe(true);
    expect(placeBid).toHaveBeenCalledWith({
      lotId: "lot-1",
      amount: 7250,
      idempotencyKey: "key-1",
      seenNextBid: "7250.00",
    });
  });

  it("sends a maximum on an open lot as a bid with a ceiling", async () => {
    const { submitter, placeBid } = ports(async () => placed);
    await submitter.submit({ ...submission, mode: "maximum", maximum: "9000.00" });
    expect(placeBid.mock.calls[0]?.[0]).toMatchObject({ amount: 7250, maxAutoBidAmount: 9000 });
  });

  it("leaves a maximum on a lot that has not opened as an absentee bid", async () => {
    const { submitter, placeBid, schedule } = ports(async () => placed);
    const outcome = await submitter.submit({
      ...submission,
      mode: "maximum",
      maximum: "9000.00",
      scheduled: true,
    });
    expect(outcome).toEqual({ ok: true, bid: null });
    expect(schedule).toHaveBeenCalledWith({
      lotId: "lot-1",
      maxAmount: 9000,
      buyerLegalEntityId: "entity-1",
    });
    expect(placeBid).not.toHaveBeenCalled();
  });

  it("types a refusal the dialog knows, with its facts", async () => {
    const { submitter } = ports(async () => ({
      ok: false,
      error: "Someone bid first",
      status: 400,
      code: "outbid_during_confirm",
      details: { nextBidAmount: "7500.00" },
    }));
    expect(await submitter.submit(submission)).toEqual({
      ok: false,
      failure: {
        kind: "refused",
        refusal: { code: "outbid_during_confirm", details: { nextBidAmount: "7500.00" } },
      },
    });
  });

  it("passes the server's words through for a refusal it has no row for", async () => {
    const { submitter } = ports(async () => ({
      ok: false,
      error: "Your account cannot bid.",
      status: 403,
      code: "account_suspended",
    }));
    expect(await submitter.submit(submission)).toEqual({
      ok: false,
      failure: { kind: "rejected", message: "Your account cannot bid." },
    });
  });

  it("reports a request that got no answer as unreachable", async () => {
    const { submitter } = ports(async () => {
      throw new Error("network");
    });
    expect(await submitter.submit(submission)).toEqual({
      ok: false,
      failure: { kind: "unreachable" },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const clearActing = vi.fn();

vi.mock("@/lib/data/http/hc-browser", () => ({
  getBrowserHc: () => ({ bids: { $post: post } }),
}));
vi.mock("@/lib/legal-entity/client-acting-context", () => ({
  clearClientActingLegalEntityId: () => clearActing(),
}));
vi.mock("@/lib/ui/admin-cannot-buy", () => ({ notifyAdminCannotBuyIfNeeded: vi.fn() }));
vi.mock("@/lib/data/http/parse", () => ({ parseBid: (d: unknown) => d }));

import { createHttpBidWriter } from "./bids";

const okResponse = {
  ok: true,
  status: 201,
  json: async () => ({ data: { id: "bid-1", amount: "10.00" } }),
};

beforeEach(() => {
  post.mockReset();
  clearActing.mockReset();
});

describe("createHttpBidWriter", () => {
  it("sends the server-resolved acting id as an explicit X-Legal-Entity-Id header", async () => {
    post.mockResolvedValue(okResponse);
    await createHttpBidWriter("ent-1").placeBid({ lotId: "l1", amount: 10 });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({ "x-legal-entity-id": "ent-1" }),
      }),
    );
  });

  it("merges idempotency key with the acting header", async () => {
    post.mockResolvedValue(okResponse);
    await createHttpBidWriter("ent-1").placeBid({
      lotId: "l1",
      amount: 10,
      idempotencyKey: "idem-1",
    });
    expect(post.mock.calls[0]?.[0].header).toEqual({
      "Idempotency-Key": "idem-1",
      "x-legal-entity-id": "ent-1",
    });
  });

  it("omits the header block entirely when no acting id and no idempotency key", async () => {
    post.mockResolvedValue(okResponse);
    await createHttpBidWriter().placeBid({ lotId: "l1", amount: 10 });
    expect(post.mock.calls[0]?.[0].header).toBeUndefined();
  });

  it("clears the stale acting cookie on a 403 not_a_member_of_legal_entity", async () => {
    post.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "not_a_member_of_legal_entity" }),
    });
    const r = await createHttpBidWriter("ent-1").placeBid({ lotId: "l1", amount: 10 });
    expect(r.ok).toBe(false);
    expect(clearActing).toHaveBeenCalledTimes(1);
  });

  it("does not clear the cookie on unrelated 403s", async () => {
    post.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "membership_required", code: "membership_required" }),
    });
    await createHttpBidWriter("ent-1").placeBid({ lotId: "l1", amount: 10 });
    expect(clearActing).not.toHaveBeenCalled();
  });
});

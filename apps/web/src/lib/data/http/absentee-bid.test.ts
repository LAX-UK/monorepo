import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("@/lib/data/http/hc-browser", () => ({
  getBrowserHc: () => ({ lots: { ":id": { "absentee-bids": { $post: post } } } }),
}));

import { createHttpAbsenteeBidWriter } from "./absentee-bid";

beforeEach(() => post.mockReset());

describe("createHttpAbsenteeBidWriter", () => {
  it("leaves the maximum for the acting account", async () => {
    post.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
    const result = await createHttpAbsenteeBidWriter("ent-1").schedule({
      lotId: "l1",
      maxAmount: 9000,
      buyerLegalEntityId: "ent-1",
    });
    expect(result).toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith({
      param: { id: "l1" },
      json: { buyerLegalEntityId: "ent-1", maxAmount: 9000 },
      header: { "x-legal-entity-id": "ent-1" },
    });
  });

  it("returns the code and facts of a refusal", async () => {
    post.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Closed", code: "lot_closed", details: { a: "b" } }),
    });
    const result = await createHttpAbsenteeBidWriter().schedule({
      lotId: "l1",
      maxAmount: 9000,
      buyerLegalEntityId: "ent-1",
    });
    expect(result).toEqual({
      ok: false,
      error: "Closed",
      status: 400,
      code: "lot_closed",
      details: { a: "b" },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();
const del = vi.fn();

vi.mock("@/lib/data/http/hc-browser", () => ({
  getBrowserHc: () => ({
    lots: {
      ":id": {
        "auto-bid": {
          $get: vi.fn(),
          $put: put,
          $delete: del,
        },
      },
    },
  }),
}));
vi.mock("@/lib/ui/admin-cannot-buy", () => ({ notifyAdminCannotBuyIfNeeded: vi.fn() }));

import { createHttpAutoBidWriter } from "./auto-bid";

function parseSettings(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.maxAutoBidAmount === "string" && typeof o.isActive === "boolean") {
    return {
      maxAutoBidAmount: o.maxAutoBidAmount,
      autoBidStepAmount: o.autoBidStepAmount == null ? null : String(o.autoBidStepAmount),
      isActive: o.isActive,
    };
  }
  if (typeof o.id === "string" && o.maxAutoBidAmount != null && o.maxAutoBidAmount !== "") {
    return {
      maxAutoBidAmount: String(o.maxAutoBidAmount),
      autoBidStepAmount: o.autoBidStepAmount == null ? null : String(o.autoBidStepAmount),
      isActive: true,
    };
  }
  return null;
}

describe("auto-bid response parsing", () => {
  it("accepts settings shape when user is winning", () => {
    expect(
      parseSettings({
        maxAutoBidAmount: "500.00",
        autoBidStepAmount: "10.00",
        isActive: true,
      }),
    ).toEqual({
      maxAutoBidAmount: "500.00",
      autoBidStepAmount: "10.00",
      isActive: true,
    });
  });

  it("accepts bid shape when save places opening bid", () => {
    expect(
      parseSettings({
        id: "bid-1",
        maxAutoBidAmount: "500.00",
        autoBidStepAmount: "10.00",
      }),
    ).toEqual({
      maxAutoBidAmount: "500.00",
      autoBidStepAmount: "10.00",
      isActive: true,
    });
  });
});

describe("createHttpAutoBidWriter", () => {
  beforeEach(() => {
    put.mockReset();
    del.mockReset();
  });

  it("surfaces code from clearAutoBid error responses", async () => {
    del.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Seller cannot bid on own lot",
        code: "seller_cannot_bid",
      }),
    });
    const result = await createHttpAutoBidWriter().clearAutoBid("lot-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("seller_cannot_bid");
      expect(result.error).toContain("Seller cannot bid");
    }
  });
});

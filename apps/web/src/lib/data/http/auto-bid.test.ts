import { describe, expect, it } from "vitest";

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

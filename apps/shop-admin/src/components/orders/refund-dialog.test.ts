import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/application/admin-operations-actions.server", () => ({
  requestOrderRefund: vi.fn(),
}));

const { validateRefund } = await import("./refund-dialog.client");

describe("validateRefund", () => {
  const base = { amountText: true, reason: "goodwill" as const, remainingPence: 2000 };

  it("accepts an amount within what can still be refunded, with a reason", () => {
    expect(validateRefund({ ...base, amountPence: 2000 })).toEqual({});
  });

  it("says how much is left when the amount is too high", () => {
    expect(validateRefund({ ...base, amountPence: 2001 }).amount).toBe(
      "At most £20.00 can still be refunded.",
    );
  });

  it("tells an empty field from text that is not an amount", () => {
    expect(validateRefund({ ...base, amountPence: null, amountText: false }).amount).toBe(
      "Enter how much to refund.",
    );
    expect(validateRefund({ ...base, amountPence: null }).amount).toBe(
      "Enter an amount in pounds, like 25 or 25.50.",
    );
  });

  it("requires a reason", () => {
    expect(validateRefund({ ...base, amountPence: 100, reason: null }).reason).toBe(
      "Choose why you are refunding.",
    );
  });
});

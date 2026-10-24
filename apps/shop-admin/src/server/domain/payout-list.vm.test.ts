import { PAYOUT_PAID_REFERENCE_MAX_LENGTH } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  PAYOUT_STATUS_LABELS,
  checkPaidReference,
  duePayoutCount,
  markPaidAvailability,
  markPaidConfirmLabel,
  markPaidTitle,
  payoutQueueKey,
  payoutReference,
  payoutSourceLabel,
  presentPayoutStatus,
} from "./payout-list.vm";

describe("presentPayoutStatus", () => {
  it("never shows a raw status value", () => {
    expect(presentPayoutStatus("pending_refund_period").label).toBe("Waiting for refund period");
    expect(presentPayoutStatus("due")).toEqual({ label: "Due", tone: "warning" });
    expect(presentPayoutStatus("paid").tone).toBe("success");
    for (const label of Object.values(PAYOUT_STATUS_LABELS)) expect(label).not.toContain("_");
  });

  it("humanises a status the API adds later", () => {
    expect(presentPayoutStatus("on_hold").label).toBe("On hold");
  });
});

describe("markPaidAvailability", () => {
  it("offers a due payout to a role that can pay", () => {
    expect(markPaidAvailability({ status: "due" }, { canMarkPaid: true })).toEqual({
      kind: "available",
    });
  });

  it("explains why a payout still in its refund period cannot be paid yet", () => {
    expect(
      markPaidAvailability({ status: "pending_refund_period" }, { canMarkPaid: true }),
    ).toEqual({ kind: "blocked", reason: "Payable once the refund period ends" });
  });

  it.each(["paid", "cancelled"])("offers nothing on a %s payout", (status) => {
    expect(markPaidAvailability({ status }, { canMarkPaid: true })).toEqual({ kind: "hidden" });
  });

  it.each(["due", "pending_refund_period", "paid", "cancelled"])(
    "hides the action on a %s payout from a role that cannot pay",
    (status) => {
      expect(markPaidAvailability({ status }, { canMarkPaid: false })).toEqual({ kind: "hidden" });
    },
  );
});

describe("the confirmation", () => {
  it("repeats the amount on the button and names the payee in the title", () => {
    expect(markPaidConfirmLabel({ netPence: 8500 })).toBe("Mark £85.00 paid");
    expect(markPaidConfirmLabel({ netPence: 123456 })).toBe("Mark £1,234.56 paid");
    expect(markPaidTitle({ ownerDisplayName: "Theo Marsh" })).toBe(
      "Mark the payout to Theo Marsh as paid?",
    );
  });

  it("quotes the payout by the first eight characters of its id", () => {
    expect(payoutReference("0f8b2c4e-1111-4222-8333-444455556666")).toBe("0f8b2c4e");
  });
});

describe("checkPaidReference", () => {
  it("asks for a reference when it is empty or blank", () => {
    expect(checkPaidReference("")).toEqual({
      ok: false,
      message: "Enter the reference from the transfer.",
    });
    expect(checkPaidReference("   ").ok).toBe(false);
  });

  it("trims a valid reference", () => {
    expect(checkPaidReference("  FPS-20261024-01 ")).toEqual({
      ok: true,
      value: "FPS-20261024-01",
    });
  });

  it("accepts the longest reference the API takes and rejects one more", () => {
    expect(checkPaidReference("a".repeat(PAYOUT_PAID_REFERENCE_MAX_LENGTH)).ok).toBe(true);
    const tooLong = checkPaidReference("a".repeat(PAYOUT_PAID_REFERENCE_MAX_LENGTH + 1));
    expect(tooLong).toEqual({
      ok: false,
      message: `Use ${PAYOUT_PAID_REFERENCE_MAX_LENGTH} characters or fewer.`,
    });
  });
});

describe("list helpers", () => {
  it("counts only the payouts that can be paid now", () => {
    expect(
      duePayoutCount([{ status: "due" }, { status: "paid" }, { status: "due" }, { status: "x" }]),
    ).toBe(2);
  });

  it("names the source of a payout", () => {
    expect(payoutSourceLabel("third_party_sale")).toBe("Third-party sale");
    expect(payoutSourceLabel("something_new")).toBe("something new");
  });
});

describe("payoutQueueKey", () => {
  it("puts payable payouts first, oldest due date first, and finished ones last", () => {
    const rows = [
      { status: "cancelled", payoutDueAt: "2026-08-01T00:00:00Z" },
      { status: "due", payoutDueAt: "2026-10-15T00:00:00Z" },
      { status: "paid", payoutDueAt: "2026-09-01T00:00:00Z" },
      { status: "due", payoutDueAt: "2026-10-02T00:00:00Z" },
      { status: "pending_refund_period", payoutDueAt: "2026-11-05T00:00:00Z" },
    ];
    const sorted = [...rows].sort((a, b) => payoutQueueKey(a).localeCompare(payoutQueueKey(b)));
    expect(sorted.map((row) => `${row.status}`)).toEqual([
      "due",
      "due",
      "pending_refund_period",
      "paid",
      "cancelled",
    ]);
    expect(sorted[0]?.payoutDueAt).toBe("2026-10-02T00:00:00Z");
  });
});

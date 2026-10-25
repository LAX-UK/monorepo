import { describe, expect, it } from "vitest";
import {
  markPaidAvailability,
  markPaidConfirmLabel,
  markPaidTitle,
  payoutReference,
  payoutSourceLabel,
  presentPayoutStatus,
} from "./payout-list.vm";

describe("presentPayoutStatus", () => {
  it("never shows a raw status value", () => {
    expect(presentPayoutStatus("pending_refund_period").label).toBe("Waiting for refund period");
    expect(presentPayoutStatus("due")).toEqual({ label: "Due", tone: "warning" });
    expect(presentPayoutStatus("paid").tone).toBe("success");
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

describe("list helpers", () => {
  it("names the source of a payout", () => {
    expect(payoutSourceLabel("third_party_sale")).toBe("Third-party sale");
    expect(payoutSourceLabel("something_new")).toBe("Something new");
  });
});

import type { PaymentStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  decisivePayment,
  decisivePaymentByLot,
  purchaseEnding,
  purchaseIsOwned,
  purchaseIsToPay,
} from "./purchase-state.js";

describe("purchaseEnding", () => {
  it.each([
    [null, null, null],
    ["pending", null, null],
    ["captured", "released", null],
    ["refunded", null, "refunded"],
    ["cancelled", null, null],
    ["cancelled", "awaiting_payment", null],
    ["pending", "cancelled", "cancelled"],
    ["cancelled", "cancelled", "cancelled"],
    ["refunded", "cancelled", "refunded"],
    ["captured", "cancelled", "cancelled"],
  ] as const)("payment %s, fulfilment %s: %s", (paymentStatus, fulfilmentStatus, ending) => {
    expect(purchaseEnding({ paymentStatus, fulfilmentStatus })).toBe(ending);
  });
});

describe("purchaseIsToPay", () => {
  it.each<[PaymentStatus | null, boolean]>([
    [null, true],
    ["pending", true],
    ["requires_manual_review", true],
    ["authorized", false],
    ["captured", false],
    ["refunded", false],
    ["cancelled", true],
  ])("payment %s: %s", (paymentStatus, owed) => {
    expect(purchaseIsToPay({ paymentStatus })).toBe(owed);
  });

  it("still owes after an abandoned, cancelled or failed payment row", () => {
    expect(
      purchaseIsToPay({ paymentStatus: "cancelled", fulfilmentStatus: "awaiting_payment" }),
    ).toBe(true);
  });

  it("is never owed once the sale was cancelled, whatever the payment row says", () => {
    for (const paymentStatus of ["pending", "cancelled", null] as const) {
      expect(purchaseIsToPay({ paymentStatus, fulfilmentStatus: "cancelled" })).toBe(false);
    }
  });

  it("is never owed once delivery was cancelled", () => {
    expect(purchaseIsToPay({ paymentStatus: "pending", fulfilmentStatus: "cancelled" })).toBe(
      false,
    );
  });
});

describe("purchaseIsOwned", () => {
  it("owns a paid purchase", () => {
    expect(purchaseIsOwned({ invoice: "paid", deliveryStage: "choose" })).toBe(true);
    expect(purchaseIsOwned({ invoice: "paid", deliveryStage: "collected" })).toBe(true);
  });

  it.each(["not_invoiced", "due", "overdue", "processing", "refunded", "cancelled"] as const)(
    "does not own a purchase that is %s",
    (invoice) => {
      expect(purchaseIsOwned({ invoice, deliveryStage: "awaiting_payment" })).toBe(false);
    },
  );

  it("does not own a paid purchase whose delivery was cancelled", () => {
    expect(purchaseIsOwned({ invoice: "paid", deliveryStage: "cancelled" })).toBe(false);
  });
});

describe("decisivePayment", () => {
  const attempt = (id: string, status: PaymentStatus) => ({ id, status });

  it("is the newest attempt when none has settled", () => {
    expect(decisivePayment([attempt("new", "pending"), attempt("old", "cancelled")])?.id).toBe(
      "new",
    );
  });

  it.each(["captured", "authorized", "refunded"] as const)(
    "prefers a %s payment over a newer abandoned attempt",
    (status) => {
      expect(decisivePayment([attempt("new", "pending"), attempt("paid", status)])?.id).toBe(
        "paid",
      );
    },
  );

  it("is undefined when there are no attempts", () => {
    expect(decisivePayment([])).toBeUndefined();
  });
});

describe("decisivePaymentByLot", () => {
  const attempt = (id: string, lotId: string, status: PaymentStatus) => ({ id, lotId, status });

  it("picks the deciding payment of each lot on its own", () => {
    const byLot = decisivePaymentByLot([
      attempt("a-new", "a", "pending"),
      attempt("b-only", "b", "cancelled"),
      attempt("a-paid", "a", "captured"),
    ]);
    expect(byLot.get("a")?.id).toBe("a-paid");
    expect(byLot.get("b")?.id).toBe("b-only");
    expect(byLot.size).toBe(2);
  });

  it("is empty without payments", () => {
    expect(decisivePaymentByLot([]).size).toBe(0);
  });
});

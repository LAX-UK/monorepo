import { describe, expect, it } from "vitest";
import { isOpenPaymentUniqueViolation } from "./is-open-payment-unique-violation.js";

const pg = (constraint: string) => ({
  code: "23505",
  constraint,
  message: `duplicate key value violates unique constraint "${constraint}"`,
});

describe("isOpenPaymentUniqueViolation", () => {
  it("matches either open-payment index, raw or wrapped by the query builder", () => {
    expect(isOpenPaymentUniqueViolation(pg("payment_lot_buyer_open_unique"))).toBe(true);
    expect(isOpenPaymentUniqueViolation(pg("payment_lot_buyer_open_account_unique"))).toBe(true);
    expect(
      isOpenPaymentUniqueViolation({
        message: "Failed query: insert into payment",
        cause: pg("payment_lot_buyer_open_account_unique"),
      }),
    ).toBe(true);
  });

  it("does not match other unique violations or other errors", () => {
    expect(isOpenPaymentUniqueViolation(pg("payment_stripe_charge_id_uidx"))).toBe(false);
    expect(isOpenPaymentUniqueViolation(new Error("boom"))).toBe(false);
    expect(isOpenPaymentUniqueViolation(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCIAL_YEAR_END,
  type GuestErasureOrder,
  decideGuestErasure,
  erasedGuestEmail,
  guestErasureBlockMessage,
  guestErasureConfirmed,
  guestInvoiceRetentionEndsAt,
  isErasedGuestEmail,
  isGuestOrderOpen,
  parseFinancialYearEnd,
} from "./guest-erasure.js";

const NOW = new Date("2026-10-30T12:00:00Z");

const order = (overrides: Partial<GuestErasureOrder>): GuestErasureOrder => ({
  reference: "LAX-S-10001",
  status: "paid",
  fulfilmentStatus: "delivered",
  openRefund: false,
  openCase: false,
  cancellationEndsAt: null,
  ...overrides,
});

const decide = (orders: GuestErasureOrder[]) =>
  decideGuestErasure({ erasedAt: null, claimedAt: null, orders, now: NOW });

describe("guest erasure policy", () => {
  it("treats an order as open until its print has left LAX's hands", () => {
    expect(isGuestOrderOpen(order({ status: "pending_payment", fulfilmentStatus: null }))).toBe(
      true,
    );
    expect(isGuestOrderOpen(order({ fulfilmentStatus: null }))).toBe(true);
    expect(isGuestOrderOpen(order({ fulfilmentStatus: "in_production" }))).toBe(true);
    expect(isGuestOrderOpen(order({ fulfilmentStatus: "in_storage" }))).toBe(true);
    expect(
      isGuestOrderOpen(order({ status: "partially_refunded", fulfilmentStatus: "in_transit" })),
    ).toBe(true);
    expect(isGuestOrderOpen(order({ fulfilmentStatus: "delivered" }))).toBe(false);
    expect(isGuestOrderOpen(order({ fulfilmentStatus: "collected" }))).toBe(false);
    expect(isGuestOrderOpen(order({ status: "refunded", fulfilmentStatus: null }))).toBe(false);
    expect(isGuestOrderOpen(order({ status: "expired", fulfilmentStatus: null }))).toBe(false);
  });

  it("allows erasure once every order is finished", () => {
    expect(decide([order({}), order({ status: "expired", fulfilmentStatus: null })])).toEqual({
      kind: "allowed",
    });
    expect(decide([])).toEqual({ kind: "allowed" });
  });

  it("names the orders that still need the guest's details", () => {
    const decision = decide([
      order({ reference: "LAX-S-10001", fulfilmentStatus: "awaiting_dispatch" }),
      order({ reference: "LAX-S-10002" }),
    ]);
    expect(decision).toEqual({
      kind: "blocked",
      reason: "open_order",
      orderReferences: ["LAX-S-10001"],
    });
    expect(guestErasureBlockMessage(decision)).toBe(
      "Available once LAX-S-10001 is delivered, collected or cancelled.",
    );
  });

  it("waits for a refund, a dispute, return or problem report", () => {
    const refund = decide([order({ openRefund: true })]);
    expect(refund).toMatchObject({ reason: "open_refund" });
    expect(guestErasureBlockMessage(refund)).toBe(
      "Available once the refund on LAX-S-10001 has gone through.",
    );
    const dispute = decide([order({ openCase: true })]);
    expect(dispute).toMatchObject({ reason: "open_case" });
    expect(guestErasureBlockMessage(dispute)).toContain("problem report on LAX-S-10001 is closed");
  });

  it("waits until the right to cancel has ended", () => {
    const decision = decide([order({ cancellationEndsAt: new Date("2026-11-13T12:00:00Z") })]);
    expect(decision).toMatchObject({ reason: "cancellation_window" });
    expect(guestErasureBlockMessage(decision)).toBe(
      "Available after 13 Nov 2026, when the right to cancel LAX-S-10001 ends.",
    );
    expect(decide([order({ cancellationEndsAt: new Date("2026-10-01T00:00:00Z") })])).toEqual({
      kind: "allowed",
    });
    // A refunded order has nothing left to cancel.
    expect(
      decide([order({ status: "refunded", cancellationEndsAt: new Date("2026-11-13T12:00:00Z") })]),
    ).toEqual({ kind: "allowed" });
  });

  it("sends a claimed guest to account closure, and never erases twice", () => {
    const claimed = decideGuestErasure({ erasedAt: null, claimedAt: NOW, orders: [], now: NOW });
    expect(claimed).toMatchObject({ kind: "blocked", reason: "claimed" });
    expect(guestErasureBlockMessage(claimed)).toContain("closing that account");
    expect(
      decideGuestErasure({ erasedAt: NOW, claimedAt: NOW, orders: [], now: NOW }),
    ).toMatchObject({ reason: "already_erased" });
    expect(guestErasureBlockMessage({ kind: "allowed" })).toBeNull();
  });

  it("keeps invoice data for six years from the end of the financial year", () => {
    const september = DEFAULT_FINANCIAL_YEAR_END;
    expect(
      guestInvoiceRetentionEndsAt(new Date("2026-10-30T12:00:00Z"), september).toISOString(),
    ).toBe("2033-09-30T23:59:59.000Z");
    expect(
      guestInvoiceRetentionEndsAt(new Date("2026-02-10T12:00:00Z"), september).toISOString(),
    ).toBe("2032-09-30T23:59:59.000Z");
    // A different year end, from configuration.
    expect(
      guestInvoiceRetentionEndsAt(new Date("2026-02-10T12:00:00Z"), {
        month: 3,
        day: 31,
      }).toISOString(),
    ).toBe("2032-03-31T23:59:59.000Z");
  });

  it("is never shorter than six years from the invoice date", () => {
    for (const day of ["2026-09-30T23:00:00Z", "2026-10-01T00:00:00Z", "2027-02-28T12:00:00Z"]) {
      const invoiced = new Date(day);
      const sixYears = new Date(invoiced);
      sixYears.setUTCFullYear(sixYears.getUTCFullYear() + 6);
      expect(
        guestInvoiceRetentionEndsAt(invoiced, DEFAULT_FINANCIAL_YEAR_END).getTime(),
      ).toBeGreaterThanOrEqual(sixYears.getTime());
    }
  });

  it("reads the year end from configuration as MM-DD", () => {
    expect(parseFinancialYearEnd("09-30")).toEqual({ month: 9, day: 30 });
    expect(parseFinancialYearEnd("02-29")).toEqual({ month: 2, day: 29 });
    expect(parseFinancialYearEnd("09-31")).toBeNull();
    expect(parseFinancialYearEnd("30/09")).toBeNull();
  });

  it("replaces the email with a value nothing can be sent to", () => {
    const erased = erasedGuestEmail("2f0b6d7e-0000-4000-8000-000000000001");
    expect(erased).not.toContain("@");
    expect(erased).toBe(erased.trim().toLowerCase());
    expect(isErasedGuestEmail(erased)).toBe(true);
    expect(isErasedGuestEmail("ada@example.com")).toBe(false);
  });

  it("confirms only when the typed email matches", () => {
    expect(guestErasureConfirmed({ typed: " Ada@Example.com ", email: "ada@example.com" })).toBe(
      true,
    );
    expect(guestErasureConfirmed({ typed: "ada@example.co", email: "ada@example.com" })).toBe(
      false,
    );
  });
});

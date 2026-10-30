import { describe, expect, it } from "vitest";
import {
  type GuestErasureOrder,
  decideGuestErasure,
  erasedGuestEmail,
  guestErasureBlockMessage,
  guestErasureConfirmed,
  isErasedGuestEmail,
  isGuestOrderOpen,
} from "./guest-erasure.js";

const order = (overrides: Partial<GuestErasureOrder>): GuestErasureOrder => ({
  reference: "LAX-S-10001",
  status: "paid",
  fulfilmentStatus: "delivered",
  ...overrides,
});

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
    expect(isGuestOrderOpen(order({ status: "cancelled", fulfilmentStatus: null }))).toBe(false);
  });

  it("allows erasure once every order is finished", () => {
    expect(
      decideGuestErasure({
        erasedAt: null,
        claimedAt: null,
        orders: [order({}), order({ status: "expired", fulfilmentStatus: null })],
      }),
    ).toEqual({ kind: "allowed" });
    expect(decideGuestErasure({ erasedAt: null, claimedAt: null, orders: [] })).toEqual({
      kind: "allowed",
    });
  });

  it("names the orders that still need the guest's details", () => {
    const decision = decideGuestErasure({
      erasedAt: null,
      claimedAt: null,
      orders: [
        order({ reference: "LAX-S-10001", fulfilmentStatus: "awaiting_dispatch" }),
        order({ reference: "LAX-S-10002" }),
      ],
    });
    expect(decision).toEqual({
      kind: "blocked",
      reason: "open_order",
      openOrderReferences: ["LAX-S-10001"],
    });
    expect(guestErasureBlockMessage(decision)).toBe(
      "Finish or cancel LAX-S-10001 first: the order still needs the guest's details.",
    );
  });

  it("sends a claimed guest to account closure, and never erases twice", () => {
    const at = new Date("2026-10-30T12:00:00Z");
    const claimed = decideGuestErasure({ erasedAt: null, claimedAt: at, orders: [] });
    expect(claimed).toMatchObject({ kind: "blocked", reason: "claimed" });
    expect(guestErasureBlockMessage(claimed)).toContain("closing that account");
    expect(decideGuestErasure({ erasedAt: at, claimedAt: at, orders: [] })).toMatchObject({
      reason: "already_erased",
    });
    expect(guestErasureBlockMessage({ kind: "allowed" })).toBeNull();
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

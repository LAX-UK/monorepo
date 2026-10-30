import { describe, expect, it } from "vitest";
import { GUEST_ERASURE_COPY, guestErasedNotice, shouldLoadGuestErasure } from "./guest-erasure.vm";

describe("guest erasure view model", () => {
  it("offers erasure only on a guest's own order to people who may erase", () => {
    const guest = { canErase: true, buyerIsGuest: true, guestCustomerId: "g-1" };
    expect(shouldLoadGuestErasure(guest)).toBe(true);
    expect(shouldLoadGuestErasure({ ...guest, canErase: false })).toBe(false);
    expect(shouldLoadGuestErasure({ ...guest, buyerIsGuest: false })).toBe(false);
    expect(shouldLoadGuestErasure({ ...guest, guestCustomerId: null })).toBe(false);
  });

  it("says what goes, what stays and that it cannot be undone", () => {
    expect(GUEST_ERASURE_COPY.description).toContain("6-year accounting record");
    expect(GUEST_ERASURE_COPY.description).toContain("cannot be undone");
  });

  it("dates the erasure in the notice that replaces the guest's details", () => {
    expect(guestErasedNotice("2026-10-30T12:00:00.000Z").title).toBe(
      "Personal data erased on 30 Oct 2026",
    );
  });
});

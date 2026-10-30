import type { AdminGuestErasureState } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  GUEST_ERASURE_COPY,
  guestErasedLine,
  guestErasureMenuReason,
  shouldLoadGuestErasure,
} from "./guest-erasure.vm";

const blocked = (overrides: Partial<AdminGuestErasureState>): AdminGuestErasureState => ({
  guestCustomerId: "g-1",
  erasedAt: null,
  allowed: false,
  blockedReason: "open_order",
  blockedMessage: "Available once LAX-S-10018 is delivered, collected or cancelled.",
  blockingOrderReferences: ["LAX-S-10018"],
  availableFrom: null,
  ...overrides,
});

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

  it("keeps a quiet, dated line once the guest is erased", () => {
    expect(guestErasedLine("2026-10-30T12:00:00.000Z")).toBe(
      "Guest data erased on 30 Oct 2026 by LAX",
    );
  });

  it("says briefly why erasure waits, naming this order or another", () => {
    expect(guestErasureMenuReason(blocked({}), "LAX-S-10018")).toBe(
      "Available once this order is complete",
    );
    expect(guestErasureMenuReason(blocked({}), "LAX-S-10017")).toBe(
      "Available once LAX-S-10018 is complete",
    );
    expect(
      guestErasureMenuReason(
        blocked({ blockedReason: "open_refund", blockingOrderReferences: ["A", "B"] }),
        "A",
      ),
    ).toBe("Available once the refund on other orders is done");
    expect(
      guestErasureMenuReason(
        blocked({ blockedReason: "cancellation_window", availableFrom: "2026-11-11T12:00:00Z" }),
        "LAX-S-10018",
      ),
    ).toBe("Available after 11 Nov 2026");
    expect(guestErasureMenuReason(blocked({ allowed: true, blockedReason: null }), "x")).toBeNull();
  });
});

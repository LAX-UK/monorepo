import { describe, expect, it } from "vitest";
import {
  decideGuestEmail,
  guestCustomerIdFromSubject,
  guestOrderLinkExpiry,
  guestOrderLinkState,
  guestOrderSubject,
  isGuestOrderSubject,
  isPlausibleGuestEmail,
  normaliseGuestEmail,
} from "./guest-checkout.js";

describe("guest checkout rules", () => {
  it("normalises case and surrounding space", () => {
    expect(normaliseGuestEmail("  Ada.Lovelace@Example.COM ")).toBe("ada.lovelace@example.com");
  });

  it("accepts a plausible email and rejects the rest", () => {
    expect(isPlausibleGuestEmail(" ada@example.com ")).toBe(true);
    expect(isPlausibleGuestEmail("ada@example")).toBe(false);
    expect(isPlausibleGuestEmail("ada example.com")).toBe(false);
    expect(isPlausibleGuestEmail(`${"a".repeat(250)}@x.com`)).toBe(false);
  });

  it("sends anyone with a LAX account to sign in", () => {
    expect(decideGuestEmail({ hasLaxAccount: true })).toBe("sign_in_required");
    expect(decideGuestEmail({ hasLaxAccount: false })).toBe("continue_as_guest");
  });

  it("round-trips the guest owner and leaves account subjects alone", () => {
    const subject = guestOrderSubject("2f0b6d7e-0000-4000-8000-000000000001");
    expect(isGuestOrderSubject(subject)).toBe(true);
    expect(guestCustomerIdFromSubject(subject)).toBe("2f0b6d7e-0000-4000-8000-000000000001");
    expect(guestCustomerIdFromSubject("user_123")).toBeNull();
    expect(guestCustomerIdFromSubject("guest:")).toBeNull();
  });

  it("opens a link until it expires, and never once the order is claimed", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    const expiresAt = guestOrderLinkExpiry(now);
    expect(expiresAt.toISOString()).toBe("2026-11-29T12:00:00.000Z");
    const guest = guestOrderSubject("g1");
    expect(guestOrderLinkState({ expiresAt, orderSubject: guest, now })).toBe("valid");
    expect(guestOrderLinkState({ expiresAt: now, orderSubject: guest, now })).toBe("expired");
    expect(guestOrderLinkState({ expiresAt, orderSubject: "user_1", now })).toBe("claimed");
  });
});

import type { LegalEntityStatus, UserKycStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { holdStartAt, identityHeldSinceAfter, payHeldSinceAfter } from "./pay-hold.js";

const T1 = new Date("2026-03-01T10:00:00Z");
const T2 = new Date("2026-04-01T10:00:00Z");

describe("payHeldSinceAfter: an organisation's hold", () => {
  const step = (from: LegalEntityStatus, to: LegalEntityStatus, heldSince: Date | null, at = T2) =>
    payHeldSinceAfter({ from, to, heldSince, at });

  it("starts when a payable organisation becomes one that cannot pay", () => {
    expect(step("approved", "docs_requested", null)).toEqual(T2);
    expect(step("connect_pending", "under_review", null)).toEqual(T2);
    expect(step("restricted", "archived", null)).toEqual(T2);
  });

  it("is kept through every step between statuses that cannot pay", () => {
    expect(step("docs_requested", "docs_received", T1)).toEqual(T1);
    expect(step("docs_received", "under_review", T1)).toEqual(T1);
    expect(step("under_review", "docs_requested", T1)).toEqual(T1);
  });

  it("clears when paying opens again, and is untouched between statuses that can pay", () => {
    expect(step("under_review", "connect_pending", T1)).toBeNull();
    expect(step("approved", "restricted", null)).toBeNull();
  });

  it("is none for an organisation that was never payable", () => {
    expect(step("lead", "docs_requested", null)).toBeNull();
  });

  it("follows approved, documents asked for, received, under review, approved without resetting", () => {
    const path: LegalEntityStatus[] = [
      "approved",
      "docs_requested",
      "docs_received",
      "under_review",
      "approved",
    ];
    let held: Date | null = null;
    const seen: (Date | null)[] = [];
    for (let i = 1; i < path.length; i += 1) {
      held = payHeldSinceAfter({
        from: path[i - 1] as LegalEntityStatus,
        to: path[i] as LegalEntityStatus,
        heldSince: held,
        at: new Date(T1.getTime() + i * 86_400_000),
      });
      seen.push(held);
    }
    const lostAt = new Date(T1.getTime() + 86_400_000);
    expect(seen).toEqual([lostAt, lostAt, lostAt, null]);
  });
});

describe("identityHeldSinceAfter: a person's hold", () => {
  const step = (from: UserKycStatus, to: UserKycStatus, heldSince: Date | null) =>
    identityHeldSinceAfter({ from, to, heldSince, at: T2 });

  it("starts when an approved identity stops being approved", () => {
    expect(step("approved", "rejected", null)).toEqual(T2);
    expect(step("approved", "pending", null)).toEqual(T2);
  });

  it("is kept while the identity is not approved, and none if it never was", () => {
    expect(step("pending", "rejected", T1)).toEqual(T1);
    expect(step("unverified", "pending", null)).toBeNull();
  });

  it("clears on approval", () => {
    expect(step("pending", "approved", T1)).toBeNull();
  });
});

describe("holdStartAt", () => {
  it("is the recorded moment, or the beginning of time", () => {
    expect(holdStartAt(T1)).toEqual(T1);
    expect(holdStartAt(null)).toEqual(new Date(0));
    expect(holdStartAt(undefined)).toEqual(new Date(0));
  });
});

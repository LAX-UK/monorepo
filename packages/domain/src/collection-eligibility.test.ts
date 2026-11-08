import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type CollectionBlockReason,
  type CollectionLotFacts,
  collectionBlockMessage,
  collectionBooker,
  collectionEligibility,
  lotSelectionRefusal,
} from "./collection-eligibility.js";

const ready: CollectionLotFacts = {
  paymentCleared: true,
  openChecks: [],
  organisationStatus: null,
  disputeOpen: false,
  refundOpen: false,
  fulfilment: "none",
  activeBookingId: null,
};
const facts = (over: Partial<CollectionLotFacts>): CollectionLotFacts => ({ ...ready, ...over });

describe("collectionEligibility", () => {
  it("lets a cleared, unblocked lot be booked, for a person or an approved organisation", () => {
    expect(collectionEligibility(ready)).toEqual({ eligible: true });
    expect(collectionEligibility(facts({ organisationStatus: "approved" }))).toEqual({
      eligible: true,
    });
  });

  it("waits for cleared payment", () => {
    expect(collectionEligibility(facts({ paymentCleared: false }))).toEqual({
      eligible: false,
      reason: "payment_not_cleared",
    });
  });

  it.each([
    ["identity", "identity_check_open"],
    ["source_of_funds", "source_of_funds_check_open"],
    ["finance", "finance_check_open"],
  ] as const)("holds the lot while a %s check is open", (check, reason) => {
    expect(collectionEligibility(facts({ openChecks: [check] }))).toEqual({
      eligible: false,
      reason,
    });
  });

  it.each(["restricted", "rejected", "archived"] as LegalEntityStatus[])(
    "holds a %s organisation",
    (organisationStatus) => {
      expect(collectionEligibility(facts({ organisationStatus }))).toEqual({
        eligible: false,
        reason: "organisation_restricted",
      });
    },
  );

  it.each([
    "lead",
    "docs_requested",
    "docs_received",
    "under_review",
    "connect_pending",
    "approved",
  ] as LegalEntityStatus[])(
    "does not hold a %s organisation that has paid",
    (organisationStatus) => {
      expect(collectionEligibility(facts({ organisationStatus }))).toEqual({ eligible: true });
    },
  );

  it("holds a lot with a dispute or a refund open", () => {
    expect(collectionEligibility(facts({ disputeOpen: true }))).toEqual({
      eligible: false,
      reason: "dispute_open",
    });
    expect(collectionEligibility(facts({ refundOpen: true }))).toEqual({
      eligible: false,
      reason: "refund_open",
    });
  });

  it("refuses a lot that is cancelled, collected, or being delivered", () => {
    expect(collectionEligibility(facts({ fulfilment: "cancelled" }))).toEqual({
      eligible: false,
      reason: "lot_cancelled",
    });
    expect(collectionEligibility(facts({ fulfilment: "collected" }))).toEqual({
      eligible: false,
      reason: "lot_collected",
    });
    for (const fulfilment of ["courier", "shipper"] as const) {
      expect(collectionEligibility(facts({ fulfilment }))).toEqual({
        eligible: false,
        reason: "lot_delivery_arranged",
      });
    }
  });

  it("refuses a lot already in a booking", () => {
    expect(collectionEligibility(facts({ activeBookingId: "booking-1" }))).toEqual({
      eligible: false,
      reason: "already_booked",
    });
  });

  it("names the first reason when several apply: the lot's own state before checks", () => {
    expect(
      collectionEligibility(
        facts({ fulfilment: "cancelled", paymentCleared: false, openChecks: ["identity"] }),
      ),
    ).toEqual({ eligible: false, reason: "lot_cancelled" });
    expect(
      collectionEligibility(facts({ paymentCleared: false, openChecks: ["identity"] })),
    ).toEqual({ eligible: false, reason: "payment_not_cleared" });
    expect(
      collectionEligibility(facts({ openChecks: ["finance", "identity"], disputeOpen: true })),
    ).toEqual({ eligible: false, reason: "identity_check_open" });
  });
});

describe("collectionBlockMessage", () => {
  const reasons: CollectionBlockReason[] = [
    "payment_not_cleared",
    "identity_check_open",
    "source_of_funds_check_open",
    "finance_check_open",
    "organisation_restricted",
    "dispute_open",
    "refund_open",
    "lot_cancelled",
    "lot_collected",
    "lot_delivery_arranged",
    "already_booked",
  ];

  it("has a sentence for every reason, in plain words", () => {
    for (const reason of reasons) {
      const message = collectionBlockMessage(reason);
      expect(message.length).toBeGreaterThan(10);
      expect(message).toMatch(/[.]$/);
      expect(message).not.toMatch(/_|KYC|AML|Stripe/);
    }
  });

  it("uses the approved wording for a source-of-funds hold", () => {
    expect(collectionBlockMessage("source_of_funds_check_open")).toBe(
      "Collection and delivery open once we've finished checking the source of funds for this purchase. We'll email you as soon as you can book.",
    );
  });
});

describe("collectionBooker", () => {
  const member = (role: LegalEntityMemberRole, isImpersonation?: boolean) => ({
    role,
    ...(isImpersonation === undefined ? {} : { isImpersonation }),
  });
  const org = (userId: string, role: LegalEntityMemberRole | null, winnerId: string | null) =>
    collectionBooker({
      userId,
      accountKind: "organisation",
      winnerId,
      membership: role === null ? null : member(role),
    });

  it("lets a person book the lots they won on their own account", () => {
    const base = { accountKind: "individual", membership: null } as const;
    expect(collectionBooker({ ...base, userId: "u1", winnerId: "u1" })).toEqual({ allowed: true });
    expect(collectionBooker({ ...base, userId: "u2", winnerId: "u1" })).toEqual({
      allowed: false,
      reason: "not_winner",
    });
    expect(collectionBooker({ ...base, userId: "u1", winnerId: null })).toEqual({
      allowed: false,
      reason: "not_winner",
    });
  });

  it.each(["owner", "admin", "finance"] as const)(
    "lets an organisation's %s book any paid lot",
    (role) => {
      expect(org("u9", role, "someone-else")).toEqual({ allowed: true });
      expect(org("u9", role, null)).toEqual({ allowed: true });
    },
  );

  it("lets a buyer agent book the lots they won, and only those", () => {
    expect(org("agent", "buyer_agent", "agent")).toEqual({ allowed: true });
    expect(org("agent", "buyer_agent", "colleague")).toEqual({
      allowed: false,
      reason: "not_booker",
    });
    expect(org("agent", "buyer_agent", null)).toEqual({ allowed: false, reason: "not_booker" });
  });

  it.each(["consignor", "viewer"] as const)("does not let a %s book", (role) => {
    expect(org("u1", role, "u1")).toEqual({ allowed: false, reason: "not_booker" });
  });

  it("does not let someone outside the organisation book", () => {
    expect(org("stranger", null, "stranger")).toEqual({ allowed: false, reason: "not_member" });
  });

  it("keeps an impersonating admin read-only on every kind of account, checked first", () => {
    expect(
      collectionBooker({
        userId: "u1",
        accountKind: "individual",
        winnerId: "u1",
        membership: null,
        isImpersonation: true,
      }),
    ).toEqual({ allowed: false, reason: "read_only" });
    for (const role of ["owner", "admin", "finance", "buyer_agent"] as const) {
      expect(
        collectionBooker({
          userId: "u1",
          accountKind: "organisation",
          winnerId: "u1",
          membership: { role },
          isImpersonation: true,
        }),
      ).toEqual({ allowed: false, reason: "read_only" });
    }
    // Checked before membership: even a non-member is told read-only, not "not a member".
    expect(
      collectionBooker({
        userId: "admin",
        accountKind: "organisation",
        winnerId: null,
        membership: null,
        isImpersonation: true,
      }),
    ).toEqual({ allowed: false, reason: "read_only" });
  });

  it("does not treat an explicit isImpersonation of false as read-only", () => {
    expect(
      collectionBooker({
        userId: "u1",
        accountKind: "individual",
        winnerId: "u1",
        membership: null,
        isImpersonation: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("keeps a platform admin viewing as the organisation read-only", () => {
    expect(
      collectionBooker({
        userId: "admin",
        accountKind: "organisation",
        winnerId: "admin",
        membership: member("owner", true),
      }),
    ).toEqual({ allowed: false, reason: "read_only" });
  });
});

describe("lotSelectionRefusal", () => {
  const lot = (n: number, accountId = "acc", placeId = "gallery") => ({
    lotId: `lot-${n}`,
    accountId,
    placeId,
  });
  const lots = (count: number) => Array.from({ length: count }, (_, i) => lot(i));

  it("accepts one lot, and up to 20 in one visit", () => {
    expect(lotSelectionRefusal(lots(1))).toBeNull();
    expect(lotSelectionRefusal(lots(19))).toBeNull();
    expect(lotSelectionRefusal(lots(20))).toBeNull();
  });

  it("refuses an empty selection and more than 20", () => {
    expect(lotSelectionRefusal([])).toBe("no_lots");
    expect(lotSelectionRefusal(lots(21))).toBe("too_many_lots");
  });

  it("refuses the same lot twice", () => {
    expect(lotSelectionRefusal([lot(1), lot(1)])).toBe("duplicate_lots");
  });

  it("refuses lots of different accounts or from different places", () => {
    expect(lotSelectionRefusal([lot(1), lot(2, "other")])).toBe("mixed_accounts");
    expect(lotSelectionRefusal([lot(1), lot(2, "acc", "warehouse")])).toBe("mixed_places");
  });

  it("takes a different limit when the rules change", () => {
    expect(lotSelectionRefusal(lots(5), 4)).toBe("too_many_lots");
  });
});

import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_ALWAYS_DELIVERED_TYPES,
  NOTIFICATION_IGNORES_QUIET_HOURS_TYPES,
  notificationIgnoresQuietHours,
  notificationIsMutable,
  notificationSilencedByMute,
} from "./notification-mutes.js";

describe("notifications a mute never silences", () => {
  /** The full table, written out so a change to it is a visible test change. */
  it("lists the required notices", () => {
    expect([...NOTIFICATION_ALWAYS_DELIVERED_TYPES]).toEqual([
      "payment_due",
      "lot_won",
      "payout_problem",
      "delivery_quote_ready",
      "consignment_agreement_reminder",
      "submission_changes_requested",
      "kyc_resubmission_required",
      "source_of_funds_documents_requested",
      "source_of_funds_approved",
      "source_of_funds_rejected",
      "organisation_member_left",
      "payout_bank_changed",
      "staff_role_expired",
      "staff_role_expired_admin",
      "staff_role_changed",
      "staff_role_changed_admin",
    ]);
  });

  it.each([...NOTIFICATION_ALWAYS_DELIVERED_TYPES])("always delivers %s", (type) => {
    expect(notificationIsMutable(type)).toBe(false);
    expect(notificationSilencedByMute({ type, legalEntityId: "org-1" }, ["org-1"])).toBe(false);
  });

  it.each([
    "outbid",
    "lot_ending_soon",
    "watchlist_starting",
    "watchlist_ending_soon",
    "lot_lost",
    "consignment_update",
    "lot_ended_seller",
  ])("lets a mute silence the informational %s", (type) => {
    expect(notificationIsMutable(type)).toBe(true);
    expect(notificationSilencedByMute({ type, legalEntityId: "org-1" }, new Set(["org-1"]))).toBe(
      true,
    );
  });
});

describe("notificationSilencedByMute", () => {
  it("only silences notices about a muted account", () => {
    expect(notificationSilencedByMute({ type: "outbid", legalEntityId: "org-2" }, ["org-1"])).toBe(
      false,
    );
  });

  it("never silences a personal notice", () => {
    expect(notificationSilencedByMute({ type: "outbid", legalEntityId: null }, ["org-1"])).toBe(
      false,
    );
  });
});

describe("notices that go out during quiet hours", () => {
  it("is only the payout bank change, which is also always delivered", () => {
    expect([...NOTIFICATION_IGNORES_QUIET_HOURS_TYPES]).toEqual(["payout_bank_changed"]);
    for (const type of NOTIFICATION_IGNORES_QUIET_HOURS_TYPES) {
      expect(NOTIFICATION_ALWAYS_DELIVERED_TYPES).toContain(type);
    }
    expect(notificationIgnoresQuietHours("lot_won")).toBe(false);
  });
});

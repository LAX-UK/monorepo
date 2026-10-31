import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_NEEDS_ACTION_WHILE_LOT_OPEN,
  notificationNeedsAction,
} from "./notification-needs-action.js";

describe("notificationNeedsAction", () => {
  it.each([
    "outbid",
    "payment_due",
    "consignment_agreement_reminder",
    "submission_changes_requested",
    "access_requested",
    "kyc_resubmission_required",
    "source_of_funds_documents_requested",
  ])("asks for action on %s", (type) => {
    expect(notificationNeedsAction(type)).toBe(true);
  });

  it.each(["lot_won", "lot_lost", "payment_received", "watchlist_starting", "lot_shipped"])(
    "does not ask for action on %s",
    (type) => {
      expect(notificationNeedsAction(type)).toBe(false);
    },
  );

  it("ties an outbid's action to its lot staying open", () => {
    expect(NOTIFICATION_NEEDS_ACTION_WHILE_LOT_OPEN).toEqual(["outbid"]);
  });
});

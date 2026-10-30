import { describe, expect, it } from "vitest";
import {
  ACTIVITY_EVENT_TYPES,
  activityEntry,
  activityEventTypesFor,
  activityRetentionStart,
} from "./organisation-activity.js";

const at = new Date("2026-10-30T10:00:00Z");

describe("organisation activity", () => {
  it("shows a role change with who it is about and only the allowed fields", () => {
    expect(
      activityEntry({
        id: 7,
        eventType: "legal_entity.member_role_changed",
        occurredAt: at,
        actorUserId: "owner-1",
        payload: {
          member_user_id: "m-1",
          member_id: "row-1",
          from_role: "viewer",
          to_role: "finance",
        },
      }),
    ).toEqual({
      id: 7,
      kind: "role_changed",
      group: "members",
      occurredAt: at,
      actorUserId: "owner-1",
      subjectUserId: "m-1",
      detail: { from_role: "viewer", to_role: "finance" },
    });
  });

  it("never shows an event that is not in the table", () => {
    expect(
      activityEntry({
        id: 1,
        eventType: "legal_entity.restricted",
        occurredAt: at,
        actorUserId: null,
        payload: {},
      }),
    ).toBeNull();
  });

  it("drops payload fields that are not plain values", () => {
    expect(
      activityEntry({
        id: 2,
        eventType: "legal_entity.member_removed",
        occurredAt: at,
        actorUserId: "owner-1",
        payload: { member_user_id: "m-2", role_at_removal: { nested: true } },
      })?.detail,
    ).toEqual({});
  });

  it("covers members, authorisations and limits, agreements, unsold choices, payouts and bank changes", () => {
    for (const type of [
      "legal_entity.member_accepted",
      "legal_entity.member_left",
      "legal_entity.member_removed",
      "legal_entity.member_role_changed",
      "legal_entity.member_invited",
      "legal_entity.buyer_agent_authorised",
      "legal_entity.bidding_limit_changed",
      "submission.agreement_accepted",
      "submission.unsold_choice_requested",
      "payout.paid",
      "legal_entity.payout_bank_changed",
    ]) {
      expect(ACTIVITY_EVENT_TYPES).toContain(type);
    }
  });

  it("filters by group, or shows everything when none is chosen", () => {
    expect(activityEventTypesFor(["money"])).toEqual([
      "payout.paid",
      "legal_entity.payout_bank_changed",
      "legal_entity.invoice_details_changed",
    ]);
    expect(activityEventTypesFor([])).toEqual(ACTIVITY_EVENT_TYPES);
  });

  it("keeps twelve months", () => {
    expect(activityRetentionStart(at)).toEqual(new Date("2025-10-30T10:00:00Z"));
  });
});

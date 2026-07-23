import { describe, expect, it } from "vitest";
import type { AdminStatusDomain } from "./core";
import { adminStatusToBadgeVariant } from "./resolver";

const DOMAIN_STATUS_EXPECTATIONS: Partial<
  Record<AdminStatusDomain, ReadonlyArray<[string, string]>>
> = {
  sale: [
    ["active", "live"],
    ["scheduled", "info"],
    ["draft", "info"],
    ["ended", "neutral"],
    ["cancelled", "danger"],
  ],
  lot: [
    ["active", "live"],
    ["scheduled", "info"],
    ["draft", "info"],
    ["ended", "neutral"],
    ["cancelled", "danger"],
    ["voided", "danger"],
  ],
  artist: [
    ["approved", "success"],
    ["pending", "warning"],
    ["rejected", "danger"],
    ["merged_into", "neutral"],
  ],
  submission: [
    ["approved", "success"],
    ["converted", "success"],
    ["submitted", "info"],
    ["under_review", "warning"],
    ["rejected", "danger"],
  ],
  payment: [
    ["captured", "success"],
    ["authorized", "info"],
    ["pending", "warning"],
    ["requires_manual_review", "warning"],
    ["refunded", "neutral"],
    ["cancelled", "danger"],
  ],
  payout: [
    ["paid", "success"],
    ["in_transit", "info"],
    ["scheduled", "neutral"],
    ["failed", "danger"],
    ["reversed", "danger"],
    ["clawback_pending", "danger"],
  ],
  registration: [
    ["approved", "success"],
    ["pending", "warning"],
    ["rejected", "danger"],
    ["withdrawn", "neutral"],
  ],
  kyc: [
    ["approved", "success"],
    ["pending", "warning"],
    ["rejected", "danger"],
  ],
  invitation: [
    ["accepted", "success"],
    ["pending", "warning"],
    ["expired", "neutral"],
    ["revoked", "danger"],
  ],
  inviteLifecycle: [
    ["accepted", "success"],
    ["opened", "info"],
    ["sent", "neutral"],
    ["expired", "warning"],
    ["bounced", "danger"],
  ],
  user: [
    ["active", "success"],
    ["suspended", "danger"],
  ],
  fulfilment: [
    ["delivered", "success"],
    ["in_transit", "info"],
    ["cancelled", "danger"],
    ["awaiting_payment", "warning"],
  ],
  conditionReport: [
    ["fulfilled", "success"],
    ["in_progress", "info"],
    ["requested", "warning"],
    ["declined", "danger"],
  ],
  saleroomSession: [
    ["live", "live"],
    ["paused", "warning"],
    ["closed", "neutral"],
    ["idle", "neutral"],
  ],
  emailOutbox: [
    ["sent", "success"],
    ["failed", "danger"],
    ["sending", "warning"],
    ["queued", "neutral"],
  ],
  legalEntity: [
    ["approved", "success"],
    ["rejected", "danger"],
    ["under_review", "info"],
    ["lead", "warning"],
  ],
  dispute: [
    ["won", "success"],
    ["lost", "danger"],
    ["open", "warning"],
    ["under_review", "info"],
  ],
  category: [
    ["active", "success"],
    ["archived", "danger"],
  ],
  venue: [
    ["active", "success"],
    ["archived", "neutral"],
  ],
  onsiteEvent: [
    ["published", "success"],
    ["draft", "neutral"],
    ["cancelled", "danger"],
  ],
};

describe("ADMIN_STATUS_REGISTRY variants", () => {
  for (const [domain, cases] of Object.entries(DOMAIN_STATUS_EXPECTATIONS) as [
    AdminStatusDomain,
    ReadonlyArray<[string, string]>,
  ][]) {
    describe(domain, () => {
      for (const [status, expected] of cases ?? []) {
        it(`${status} → ${expected}`, () => {
          expect(adminStatusToBadgeVariant(domain, status)).toBe(expected);
        });
      }
    });
  }
});

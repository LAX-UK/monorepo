import { describe, expect, it } from "vitest";
import { AUDIT_LOG_VIEW_IDS, AUDIT_LOG_VIEW_PREFIXES, isAuditLogView } from "./audit-log.js";
import { ALL_LIVE_DOMAIN_EVENT_TYPES } from "./domain-event-catalog/registry.js";

const viewsOf = (type: string) =>
  AUDIT_LOG_VIEW_IDS.filter((id) =>
    AUDIT_LOG_VIEW_PREFIXES[id].some((prefix) => type.startsWith(prefix)),
  );

describe("audit log views", () => {
  it("has prefixes for every view and recognises only its own ids", () => {
    for (const id of AUDIT_LOG_VIEW_IDS) {
      expect(AUDIT_LOG_VIEW_PREFIXES[id].length).toBeGreaterThan(0);
      expect(isAuditLogView(id)).toBe(true);
    }
    expect(isAuditLogView("everything")).toBe(false);
  });

  it("places staff-facing event types in exactly one view", () => {
    expect(viewsOf("payment.refunded")).toEqual(["finance"]);
    expect(viewsOf("lot.withdrawal_declined")).toEqual(["catalogue"]);
    expect(viewsOf("auth.two_factor_reset_by_staff")).toEqual(["people"]);
    expect(viewsOf("admin.impersonation_started")).toEqual(["people"]);
    for (const type of ALL_LIVE_DOMAIN_EVENT_TYPES) {
      expect(viewsOf(type).length).toBeLessThanOrEqual(1);
    }
  });

  it("leaves only machine-driven shop, bid and export events outside the views", () => {
    const unplaced = ALL_LIVE_DOMAIN_EVENT_TYPES.filter((type) => viewsOf(type).length === 0);
    expect(unplaced.every((type) => /^(shop\.|bid\.|export\.)/.test(type))).toBe(true);
  });
});

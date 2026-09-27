import { describe, expect, it } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { isZohoEventTypeEnabled, resolveZohoDeliveryMode } from "./zoho-crm-config.js";

function env(partial: Partial<WorkerEnv>): WorkerEnv {
  return partial as WorkerEnv;
}

describe("isZohoEventTypeEnabled", () => {
  it("always enables lifecycle events when person sync is allowlisted", () => {
    const e = env({
      ZOHO_CRM_SYNC_MODE: "live",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "user.registered",
    });
    expect(isZohoEventTypeEnabled(e, "user.identity_deleted")).toBe(true);
    expect(isZohoEventTypeEnabled(e, "user.deletion_requested")).toBe(true);
    expect(isZohoEventTypeEnabled(e, "bid.lot_won")).toBe(false);
  });

  it("respects dry_run for enabled types", () => {
    const e = env({
      ZOHO_CRM_SYNC_MODE: "dry_run",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "user.registered",
    });
    expect(resolveZohoDeliveryMode(e, "user.registered")).toBe("dry_run");
    expect(resolveZohoDeliveryMode(e, "user.identity_deleted")).toBe("dry_run");
  });
});

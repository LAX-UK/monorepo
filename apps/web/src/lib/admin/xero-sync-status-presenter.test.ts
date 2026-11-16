import { describe, expect, it } from "vitest";
import { xeroSyncStatusLabel } from "./xero-sync-status-presenter";
import { XERO_SYNC_STATUS_LABELS } from "./xero-sync-status.copy";

/** The values of `payment_external_sync_status` (packages/db/src/schema/xero-integration.ts). */
const SYNC_STATUSES = ["pending_sync", "synced", "error"];

describe("xeroSyncStatusLabel", () => {
  it("has a label for exactly the database sync statuses", () => {
    expect(Object.keys(XERO_SYNC_STATUS_LABELS).sort()).toEqual([...SYNC_STATUSES].sort());
  });

  it.each(Object.entries(XERO_SYNC_STATUS_LABELS))("labels %s as %s", (status, label) => {
    expect(xeroSyncStatusLabel(status)).toBe(label);
    expect(label).toMatch(/^[A-Z]/);
    expect(label).not.toContain("_");
  });

  it("falls back to sentence case for unknown values", () => {
    expect(xeroSyncStatusLabel("custom_status")).toBe("Custom status");
    expect(xeroSyncStatusLabel(null)).toBe("—");
  });
});

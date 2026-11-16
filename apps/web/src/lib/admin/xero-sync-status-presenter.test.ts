import { describe, expect, it } from "vitest";
import { XERO_SYNC_STATUS_LABELS, xeroSyncStatusLabel } from "./xero-sync-status-presenter";

describe("xeroSyncStatusLabel", () => {
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

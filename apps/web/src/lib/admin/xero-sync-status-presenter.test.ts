import { describe, expect, it } from "vitest";
import { xeroSyncStatusLabel } from "./xero-sync-status-presenter";

describe("xeroSyncStatusLabel", () => {
  it("maps known sync statuses", () => {
    expect(xeroSyncStatusLabel("pending_sync")).toBe("Pending sync");
    expect(xeroSyncStatusLabel("synced")).toBe("Synced");
    expect(xeroSyncStatusLabel("error")).toBe("Sync error");
  });

  it("falls back for unknown values", () => {
    expect(xeroSyncStatusLabel("custom_status")).toBe("custom status");
    expect(xeroSyncStatusLabel(null)).toBe("—");
  });
});

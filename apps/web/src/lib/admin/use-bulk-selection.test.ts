import { adminBulkSelectionScopeKey } from "@/lib/admin/use-bulk-selection";
import { describe, expect, it } from "vitest";

describe("adminBulkSelectionScopeKey", () => {
  it("ignores preview params so bulk selection survives drawer open/close", () => {
    const base = adminBulkSelectionScopeKey(
      "/admin/clients",
      new URLSearchParams("q=alice&client=user-1"),
    );
    const swappedPreview = adminBulkSelectionScopeKey(
      "/admin/clients",
      new URLSearchParams("q=alice&client=user-2"),
    );
    expect(base).toBe(swappedPreview);
  });

  it("changes when list filters change", () => {
    const before = adminBulkSelectionScopeKey(
      "/admin/invitations",
      new URLSearchParams("status=pending"),
    );
    const after = adminBulkSelectionScopeKey(
      "/admin/invitations",
      new URLSearchParams("status=accepted"),
    );
    expect(before).not.toBe(after);
  });
});

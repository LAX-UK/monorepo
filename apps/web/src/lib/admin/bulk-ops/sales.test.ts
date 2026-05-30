import { describe, expect, it } from "vitest";
import { bulkCancelPreflightWarning } from "./sales";

describe("bulkCancelPreflightWarning", () => {
  const rows = [
    { saleId: "s1", status: "draft" as const },
    { saleId: "s2", status: "active" as const },
    { saleId: "s3", status: "scheduled" as const },
  ];

  it("returns null when no liveish sales selected", () => {
    expect(bulkCancelPreflightWarning(["s1"], rows)).toBeNull();
  });

  it("warns when a live sale is selected", () => {
    expect(bulkCancelPreflightWarning(["s2"], rows)).toContain("approved registrations");
  });

  it("counts multiple liveish sales", () => {
    expect(bulkCancelPreflightWarning(["s2", "s3"], rows)).toContain("2 selected sales");
  });
});

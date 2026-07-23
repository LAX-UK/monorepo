import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { describe, expect, it } from "vitest";

describe("buildSnapshotKpiTile", () => {
  it("includes sparkline and flat delta for snapshot counts", () => {
    const tile = buildSnapshotKpiTile("Total lots", 30, 30, {
      compareHint: "4 published",
    });

    expect(tile.value).toBe("30");
    expect(tile.compareHint).toBe("4 published");
    expect(tile.variant).toBe("dashboard");
    expect(tile.trend?.length).toBe(30);
    expect(tile.deltaDirection).toBe("flat");
  });
});

import type { AdminConveyorPipelineRow } from "@/lib/data/http/admin.server";
import { describe, expect, it } from "vitest";
import { buildConveyorColumns, conveyorStageForRow } from "./conveyor-pipeline.vm";

function row(partial: Partial<AdminConveyorPipelineRow>): AdminConveyorPipelineRow {
  return {
    submissionId: "s1",
    title: "T",
    submissionStatus: "draft",
    convertedLotId: null,
    lotId: null,
    lotStatus: null,
    lotTitle: null,
    artistReviewRequired: false,
    archivedSeller: false,
    assignedToUserId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("conveyorStageForRow", () => {
  it("maps draft to intake", () => {
    expect(conveyorStageForRow(row({ submissionStatus: "draft" }))).toBe("intake");
  });

  it("maps converted + active lot to live", () => {
    expect(
      conveyorStageForRow(
        row({
          submissionStatus: "converted",
          lotId: "l1",
          lotStatus: "active",
          artistReviewRequired: false,
          archivedSeller: false,
        }),
      ),
    ).toBe("live");
  });

  it("blocks when artist review required", () => {
    expect(
      conveyorStageForRow(
        row({
          submissionStatus: "converted",
          lotId: "l1",
          lotStatus: "draft",
          artistReviewRequired: true,
        }),
      ),
    ).toBe("blocked");
  });
});

describe("buildConveyorColumns", () => {
  it("buckets rows into columns", () => {
    const cols = buildConveyorColumns([
      row({ submissionId: "a", submissionStatus: "draft" }),
      row({ submissionId: "b", submissionStatus: "submitted" }),
    ]);
    expect(cols.find((c) => c.id === "intake")?.items).toHaveLength(1);
    expect(cols.find((c) => c.id === "submission")?.items).toHaveLength(1);
  });
});

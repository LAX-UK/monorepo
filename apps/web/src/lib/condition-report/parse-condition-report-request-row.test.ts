import { parseConditionReportRequestRow } from "@/lib/condition-report/parse-condition-report-request-row";
import { describe, expect, it } from "vitest";

describe("parseConditionReportRequestRow", () => {
  it("parses a valid request row", () => {
    expect(
      parseConditionReportRequestRow({
        id: "req-1",
        lotId: "lot-1",
        status: "pending",
        requestNote: "Please check corners",
        responseNote: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      id: "req-1",
      lotId: "lot-1",
      status: "pending",
      requestNote: "Please check corners",
      responseNote: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns null for invalid status", () => {
    expect(
      parseConditionReportRequestRow({ id: "req-1", lotId: "lot-1", status: "unknown" }),
    ).toBeNull();
  });
});

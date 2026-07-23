import { describe, expect, it } from "vitest";
import { buildSubmissionOverviewViewModel } from "./submission-overview.vm";

describe("buildSubmissionOverviewViewModel", () => {
  const baseSubmission = {
    id: "sub-1",
    title: "Blue vase",
    description: "A fine vase",
    medium: "Ceramic",
    dimensions: "30cm",
    images: [],
    askingPrice: null,
    reservePrice: null,
    categoryId: "cat-1",
    submitterNotes: null,
    status: "submitted" as const,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReason: null,
    convertedLotId: null,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-02T10:00:00Z"),
  };

  it("builds Figma KPI tiles and quality gaps for submission missing images", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: baseSubmission,
      documentCount: 0,
      submitterDisplayName: "Jane Seller",
      currentUserId: "staff-1",
      avgQueueAgeDays: 2,
      categories: [{ id: "cat-1", name: "Ceramics" }],
    });

    expect(vm.kpiTiles.map((t) => t.id)).toEqual(["assignee", "queue-age", "documents"]);
    expect(vm.kpiTiles.find((t) => t.id === "documents")?.value).toBe("0");
    expect(vm.kpiTiles.find((t) => t.id === "queue-age")?.compareHint).toBe("Above avg");
    expect(vm.qualityGapRows.some((r) => r.id === "images")).toBe(true);
    expect(vm.attentionRows.some((r) => r.id === "missing-images")).toBe(true);
    expect(vm.attentionRows.some((r) => r.id === "missing-asking")).toBe(true);
    expect(vm.attentionRows.some((r) => r.id === "missing-documents")).toBe(true);
    expect(vm.attentionRows.some((r) => r.id === "awaiting-review")).toBe(true);
    expect(vm.nextAction?.actionLabel).toBe("Open decision");
    expect(vm.artworkDetailRows.find((r) => r.id === "title")?.verified).toBe(true);
    expect(vm.artworkDetailRows.find((r) => r.id === "category")?.value).toBe("Ceramics");
    expect(vm.internalRows.some((r) => r.id === "updated")).toBe(true);
  });

  it("returns null next action for converted submissions", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: {
        ...baseSubmission,
        status: "converted",
        convertedLotId: "lot-99",
        images: ["https://example.com/img.jpg"],
        askingPrice: "1000",
      },
      documentCount: 2,
      submitterDisplayName: "Jane Seller",
      currentUserId: "staff-1",
    });

    expect(vm.nextAction).toBeNull();
    expect(vm.internalRows.find((r) => r.id === "lot")?.value).toBe("lot-99");
    expect(vm.attentionRows.some((r) => r.id === "awaiting-review")).toBe(false);
  });

  it("handles missing dates safely in internal rows", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: {
        ...baseSubmission,
        createdAt: undefined as never,
        updatedAt: undefined as never,
        reviewedAt: null,
      },
      documentCount: 1,
      submitterDisplayName: null,
      currentUserId: "staff-1",
    });

    const created = vm.internalRows.find((r) => r.id === "created");
    const updated = vm.internalRows.find((r) => r.id === "updated");
    expect(created?.dateIso).toBeUndefined();
    expect(updated?.dateIso).toBeUndefined();
  });

  it("includes assignee KPI with take ownership hint when unassigned and actionable", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: baseSubmission,
      documentCount: 0,
      submitterDisplayName: "Jane Seller",
      currentUserId: "staff-1",
    });

    const assignee = vm.kpiTiles.find((t) => t.id === "assignee");
    expect(assignee?.label).toBe("Assigned to");
    expect(assignee?.value).toBe("Unassigned");
    expect(assignee?.compareHint).toBe("Take ownership");
  });

  it("includes assignee KPI with staff name when assigned to another reviewer", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: {
        ...baseSubmission,
        assignedToUserId: "staff-2",
      },
      documentCount: 0,
      submitterDisplayName: "Jane Seller",
      currentUserId: "staff-1",
      assigneeDisplayName: "Alex Reviewer",
    });

    const assignee = vm.kpiTiles.find((t) => t.id === "assignee");
    expect(assignee?.value).toBe("Alex Reviewer");
    expect(assignee?.compareHint).toBe("Alex Reviewer");
  });

  it("labels current user assignee as You in KPI tile", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: {
        ...baseSubmission,
        assignedToUserId: "staff-1",
      },
      documentCount: 0,
      submitterDisplayName: "Jane Seller",
      currentUserId: "staff-1",
      assigneeDisplayName: "Me Staff",
    });

    const assignee = vm.kpiTiles.find((t) => t.id === "assignee");
    expect(assignee?.value).toBe("You");
    expect(assignee?.compareHint).toBe("Assigned to you");
  });
});

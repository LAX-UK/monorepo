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

  it("lists what is missing and what is waiting on staff, most serious first", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: baseSubmission,
      documentCount: 0,
      avgQueueAgeDays: 2,
      categories: [{ id: "cat-1", name: "Ceramics" }],
    });

    expect(vm.stats.map((stat) => stat.id)).toEqual(["queue-age", "documents"]);
    expect(vm.stats.find((stat) => stat.id === "documents")?.value).toBe("0");
    expect(vm.stats.find((stat) => stat.id === "queue-age")?.hint).toBe("Above avg");
    const ids = vm.issues.map((issue) => issue.id);
    expect(ids).toContain("images");
    expect(ids).toContain("missing-asking");
    expect(ids).toContain("missing-documents");
    expect(ids).toContain("awaiting-review");
    expect(vm.issues.find((issue) => issue.id === "images")?.tone).toBe("danger");
    expect(vm.issues.find((issue) => issue.id === "awaiting-review")?.action?.label).toBe(
      "Open decision",
    );
  });

  it("names the categories and marks absent details as missing", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: { ...baseSubmission, medium: "" },
      documentCount: 1,
      categories: [{ id: "cat-1", name: "Ceramics" }],
    });

    expect(vm.artworkRows.find((row) => row.id === "category")?.value).toBe("Ceramics");
    expect(vm.artworkRows.find((row) => row.id === "medium")).toMatchObject({
      value: "",
      missing: true,
    });
    expect(vm.dimensionRows.find((row) => row.id === "dimensions")?.value).toBe("30cm");
  });

  it("reads provenance as a line per entry, never as raw objects", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: {
        ...baseSubmission,
        provenance: [
          { period: "1962", note: "Private collection, London" },
          { note: "Sold at auction, 1988" },
        ],
      },
      documentCount: 1,
    });
    expect(vm.artworkRows.find((row) => row.id === "provenance")?.value).toBe(
      "1962: Private collection, London\nSold at auction, 1988",
    );
  });

  it("has nothing waiting on staff once converted", () => {
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
    });

    expect(vm.issues.some((issue) => issue.id === "awaiting-review")).toBe(false);
    expect(vm.issues.some((issue) => issue.id === "missing-asking")).toBe(false);
  });

  it("flags a rejection with no reason on record", () => {
    const vm = buildSubmissionOverviewViewModel({
      submissionId: "sub-1",
      submission: { ...baseSubmission, status: "rejected" },
      documentCount: 1,
    });
    expect(vm.issues.some((issue) => issue.id === "missing-rejection-reason")).toBe(true);
  });
});

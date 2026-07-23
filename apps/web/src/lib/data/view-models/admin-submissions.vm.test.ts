import { describe, expect, it } from "vitest";
import {
  isSerializableSubmissionTableRow,
  toAdminSubmissionTableRow,
} from "./admin-submissions.vm";

describe("toAdminSubmissionTableRow", () => {
  it("maps thumbnail, category preview, typed quality, SLA, and assignee", () => {
    const row = toAdminSubmissionTableRow(
      {
        id: "sub-1",
        title: "Blue vase",
        images: ["https://cdn.example/vase.jpg"],
        medium: "Ceramic",
        categoryId: "cat-1",
        status: "under_review",
        createdAt: new Date("2026-06-01T12:00:00Z"),
        updatedAt: new Date("2026-06-10T12:00:00Z"),
        legalEntityId: "seller-1",
        description: "A vase",
        provenance: [{ note: "From studio" }],
        assignedToUserId: "staff-1",
      } as never,
      {
        currentUserId: "staff-2",
        sellerNamesById: new Map([["seller-1", "Studio Seller"]]),
        categoryNamesById: new Map([["cat-1", "Decorative Arts"]]),
        assigneeNamesById: new Map([["staff-1", "Alex"]]),
      },
    );

    expect(row.thumbnailUrl).toBe("https://cdn.example/vase.jpg");
    expect(row.createdAtIso).toBe("2026-06-01T12:00:00.000Z");
    expect(row.categoryPreview).toBe("Decorative Arts · Ceramic");
    expect(row.sellerPreview).toBe("Studio Seller");
    expect(row.assigneeLabel).toBe("Alex");
    expect(row.qualityGaps.length).toBeGreaterThan(0);
    expect(row.slaDays).not.toBeNull();
    expect(isSerializableSubmissionTableRow(row)).toBe(true);
  });

  it("labels current user assignee as You", () => {
    const row = toAdminSubmissionTableRow(
      {
        id: "sub-2",
        title: "Print",
        images: [],
        categoryId: "cat-1",
        status: "submitted",
        createdAt: new Date("2026-06-01T12:00:00Z"),
        updatedAt: new Date("2026-06-01T12:00:00Z"),
        assignedToUserId: "staff-1",
      } as never,
      { currentUserId: "staff-1" },
    );
    expect(row.assigneeLabel).toBe("You");
    expect(row.isAssignedToCurrentUser).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { buildSubmissionReviewViewModel } from "./submission-review.vm";

describe("buildSubmissionReviewViewModel", () => {
  it("builds a serializable review contract", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    const vm = buildSubmissionReviewViewModel({
      submission: {
        id: "sub-1",
        title: "Blue vase",
        images: ["https://cdn.example/vase.jpg"],
        medium: "Ceramic",
        categoryId: "cat-1",
        status: "under_review",
        createdAt: new Date("2026-06-09T12:00:00Z"),
        updatedAt: new Date("2026-06-01T12:00:00Z"),
        description: "A vase",
        provenance: [{ note: "Studio" }],
        assignedToUserId: "staff-1",
        askingPrice: "1000",
        reservePrice: null,
        submitterNotes: "Please review",
        edition: null,
      } as never,
      currentUserId: "staff-1",
      sellerPreview: "Studio Seller",
      categoryPreview: "Decorative Arts · Ceramic",
      categoryName: "Decorative Arts",
    });

    expect(vm.media).toHaveLength(1);
    expect(vm.assignee.isCurrentUser).toBe(true);
    expect(vm.quality.blocksAccept).toBe(false);
    expect(vm.categoryName).toBe("Decorative Arts");
    expect(vm.submittedLabel).toBe("6d ago");
    expect(vm.priority.label).toBe("High");
    expect(vm.slaCountdown.label).toBe("Over SLA");
    expect(vm.quality.gaps.every((gap) => gap.description.length > 0)).toBe(true);
    expect(() => JSON.stringify(vm)).not.toThrow();

    vi.useRealTimers();
  });
});

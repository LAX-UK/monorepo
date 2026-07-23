import { SubmissionReviewWorkspace } from "@/components/admin/submissions/submission-review-workspace";
import { buildSubmissionReviewViewModel } from "@/lib/data/view-models/submission-review.vm";
import { renderWithViewer } from "@/test/render-with-viewer";
import type { ItemSubmission } from "@auction/types";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/admin-submission-decision-panel", () => ({
  AdminSubmissionDecisionPanel: () => <div data-testid="decision-panel">Decision panel</div>,
}));

vi.mock("@/components/admin/submissions/submission-reassign-picker", () => ({
  SubmissionReassignPicker: () => (
    <button type="button" className="text-secondary">
      Reassign
    </button>
  ),
}));

function buildFixtureVm() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

  const vm = buildSubmissionReviewViewModel({
    submission: {
      id: "sub-1",
      title: "Blue vase",
      images: [
        "https://cdn.example/vase-1.jpg",
        "https://cdn.example/vase-2.jpg",
        "https://cdn.example/vase-3.jpg",
      ],
      medium: "Ceramic",
      categoryId: "cat-1",
      status: "under_review",
      createdAt: new Date("2026-06-09T12:00:00Z"),
      updatedAt: new Date("2026-06-01T12:00:00Z"),
      description: null,
      provenance: [],
      assignedToUserId: "staff-1",
      askingPrice: "1000",
      reservePrice: "800",
      submitterNotes: "Please review",
      edition: "1/12",
      signatureNote: null,
      dimensions: "12 in",
    } as never,
    currentUserId: "staff-1",
    sellerPreview: "Studio Seller",
    categoryPreview: "Decorative Arts · Ceramic",
    categoryName: "Decorative Arts",
    assigneeDisplayName: "Alex Reviewer",
  });

  vi.useRealTimers();
  return vm;
}

const baseSubmission = {
  title: "Blue vase",
  images: ["https://cdn.example/vase-1.jpg"],
  description: null,
  provenance: [],
  categoryId: "cat-1",
  categoryIds: ["cat-1"],
  convertedLotId: null,
  assignedToUserId: "staff-1",
} satisfies Pick<
  ItemSubmission,
  | "title"
  | "images"
  | "description"
  | "provenance"
  | "categoryId"
  | "categoryIds"
  | "convertedLotId"
  | "assignedToUserId"
>;

describe("SubmissionReviewWorkspace", () => {
  it("renders Figma-aligned drawer sections without duplicating the header title", () => {
    const vm = buildFixtureVm();

    renderWithViewer(
      <SubmissionReviewWorkspace
        vm={vm}
        submission={baseSubmission}
        layout="drawer"
        assigneeImage={null}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Blue vase" })).toBeNull();
    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("Medium")).toBeTruthy();
    expect(screen.getByText("Edition")).toBeTruthy();
    expect(screen.getByText("Submitted")).toBeTruthy();
    expect(screen.getByText("SLA")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByText("Decorative Arts")).toBeTruthy();
    expect(screen.getByText("Ceramic")).toBeTruthy();
    expect(screen.getByText("1/12")).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText(/Quality gaps/i)).toBeTruthy();
    expect(screen.getByText("Signature")).toBeTruthy();
    expect(
      screen.getByText(
        "Signature not clearly visible in any provided image. Request a detail capture.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Assignee")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reassign" })).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Asking")).toBeTruthy();
    expect(screen.getByText("Reserve")).toBeTruthy();
    expect(screen.getByText("Submitter notes")).toBeTruthy();
    expect(screen.getByTestId("decision-panel")).toBeTruthy();
  });

  it("shows the title block on full-page layout only", () => {
    const vm = buildFixtureVm();

    renderWithViewer(
      <SubmissionReviewWorkspace
        vm={vm}
        submission={baseSubmission}
        layout="page"
        assigneeImage={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "Blue vase" })).toBeTruthy();
    expect(screen.getByText("Studio Seller")).toBeTruthy();
  });
});

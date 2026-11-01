import { renderWithViewer } from "@/test/render-with-viewer";
import { StaffTooltipProvider } from "@auction/staff-ui";
import type { ItemSubmission } from "@auction/types";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubmissionDetailShell } from "./submission-detail-shell";

const { pathname, startReview } = vi.hoisted(() => ({
  pathname: { current: "/admin/submissions/sub-1" },
  startReview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => pathname.current,
}));
vi.mock("@/lib/actions/admin-submissions", () => ({
  adminAcceptSubmissionResultAction: vi.fn(),
  adminAssignSubmissionResultAction: vi.fn(),
  adminRejectSubmissionResultAction: vi.fn(),
  adminStartSubmissionReviewResultAction: (...args: unknown[]) => startReview(...args),
}));
vi.mock("@/lib/actions/admin-users-browse", () => ({
  searchAdminUsersBrowseAction: vi.fn(),
  resolveAdminUserForPickerAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({ redirectToHostedReauth: vi.fn() }));

function submission(overrides: Partial<ItemSubmission> = {}): ItemSubmission {
  return {
    id: "sub-1",
    title: "Blue vase",
    status: "submitted",
    images: ["https://cdn.example/vase.jpg"],
    description: "A fine vase",
    provenance: [],
    categoryId: "cat-1",
    categoryIds: ["cat-1"],
    assignedToUserId: null,
    convertedLotId: null,
    createdAt: new Date("2026-06-01T09:00:00Z"),
    updatedAt: new Date("2026-06-02T09:00:00Z"),
    ...overrides,
  } as ItemSubmission;
}

function renderShell(value: ItemSubmission, assignee: string | null = null) {
  return renderWithViewer(
    <StaffTooltipProvider>
      <SubmissionDetailShell
        submissionId={value.id}
        submission={value}
        title={value.title}
        documentCount={2}
        unreadMessages={0}
        submitterLegalEntityId="le-1"
        submitterDisplayName="Jane Seller"
        assigneeDisplayName={assignee}
        currentUserId="staff-1"
      >
        <p>Tab body</p>
      </SubmissionDetailShell>
    </StaffTooltipProvider>,
  );
}

describe("SubmissionDetailShell", () => {
  beforeEach(() => {
    pathname.current = "/admin/submissions/sub-1";
    startReview.mockReset();
  });

  it("shows the seller, when it came in and who has it", () => {
    renderShell(submission({ assignedToUserId: "staff-2" }), "Alex Reviewer");
    expect(screen.getByRole("heading", { level: 1, name: "Blue vase" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jane Seller" })).toHaveAttribute(
      "href",
      "/admin/legal-entities/le-1",
    );
    expect(screen.getByText("Alex Reviewer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Documents/ })).toBeInTheDocument();
  });

  it("offers Start review as the one primary action on a new submission", () => {
    startReview.mockResolvedValue({ ok: true });
    renderShell(submission());
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    expect(startReview).toHaveBeenCalledWith("sub-1");
    expect(screen.getByRole("button", { name: "Assign to me" })).toBeInTheDocument();
  });

  it("leads to the decision once under review, and not again on the decision tab", () => {
    const { unmount } = renderShell(submission({ status: "under_review" }));
    expect(screen.getByRole("link", { name: "Open decision" })).toHaveAttribute(
      "href",
      "/admin/submissions/sub-1/decision",
    );
    unmount();
    pathname.current = "/admin/submissions/sub-1/decision";
    renderShell(submission({ status: "under_review" }));
    expect(screen.queryByRole("link", { name: "Open decision" })).not.toBeInTheDocument();
  });

  it("offers Create lot once accepted, and the draft lot once converted", () => {
    const { unmount } = renderShell(submission({ status: "approved" }));
    expect(screen.getByRole("link", { name: "Create lot" })).toBeInTheDocument();
    unmount();
    renderShell(submission({ status: "converted", convertedLotId: "lot-9" }));
    expect(screen.getAllByRole("link", { name: "Open draft lot" })[0]).toHaveAttribute(
      "href",
      "/admin/lots/lot-9",
    );
  });
});

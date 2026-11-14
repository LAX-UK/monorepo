import type { SubmissionsStaffRow } from "@/lib/admin/submissions/submissions-staff-list.vm";
import { expectRowOpensPage, resetRowLinks, rowOf } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubmissionsStaffList, type SubmissionsStaffListProps } from "./submissions-staff-list";

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/submissions",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/exports/export-jobs-provider", () => ({
  useExportJobs: () => ({ startExport: vi.fn(), jobs: [] }),
}));
vi.mock("@/lib/admin/saved-views-port", () => ({
  createSavedViewsPort: () => ({
    list: async () => [],
    create: async () => undefined,
    rename: async () => undefined,
    remove: async () => undefined,
    reorder: async () => undefined,
  }),
}));
vi.mock("@/lib/actions/admin-submissions", () => ({
  adminStartSubmissionReviewResultAction: vi.fn(),
  adminAcceptSubmissionResultAction: vi.fn(),
  adminRejectSubmissionResultAction: vi.fn(),
  adminAssignSubmissionResultAction: vi.fn(),
}));

function submission(id: string, title: string, seller: string): SubmissionsStaffRow {
  return {
    id,
    title,
    thumbnailUrl: null,
    category: "Paintings",
    seller,
    statusCode: "under_review",
    status: { label: "In review", tone: "info" },
    sellerWait: null,
    waiting: null,
    waitingDays: null,
    quality: null,
    blocksAccept: false,
    gaps: [],
    assignee: null,
    assignedToMe: false,
    submittedAt: "2026-11-01T09:00:00.000Z",
    href: `/admin/submissions/${id}`,
    decisionHref: `/admin/submissions/${id}/decision`,
  } as SubmissionsStaffRow;
}

function renderList(patch: Partial<SubmissionsStaffListProps> = {}) {
  const props: SubmissionsStaffListProps = {
    rows: [
      submission("sub_1", "Downs after rain", "Ada Lovelace"),
      submission("sub_2", "Harbour at dusk", "Grace Hopper"),
    ],
    search: { queue: "accepted", sort: "sla", offset: "100" },
    views: [],
    activeQueue: "accepted",
    attention: [],
    metrics: [],
    filterChips: [],
    categories: [],
    pageSize: 100,
    pagination: null,
    currentUserId: "user_1",
    exportFilters: {},
    listError: null,
    filtered: false,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <SubmissionsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const IN_LIST = "?list=queue%3Daccepted%26sort%3Dsla%26offset%3D100";

describe("SubmissionsStaffList", () => {
  beforeEach(resetRowLinks);

  it("opens a submission's review from its row, keeping the list for Previous, Next and Back", () => {
    renderList();
    expectRowOpensPage({
      title: /Downs after rain/,
      href: `/admin/submissions/sub_1${IN_LIST}`,
      background: "Ada Lovelace",
    });
  });

  it("has no quick-view panel any more", () => {
    renderList({ search: { submission: "sub_1", preview: "sub_1" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An old `?submission=` or `?preview=` is not part of the list a record remembers.
    expect(
      within(rowOf(/Harbour at dusk/))
        .getAllByRole("link", { name: /Harbour at dusk/ })[0]
        ?.getAttribute("href"),
    ).toBe("/admin/submissions/sub_2");
  });
});

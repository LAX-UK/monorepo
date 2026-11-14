import type { LotsStaffRow } from "@/lib/admin/lots/lots-staff-list.vm";
import { expectRowOpensPage, resetRowLinks, rowOf } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LotsStaffList, type LotsStaffListProps } from "./lots-staff-list";

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/lots",
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

function lot(id: string, title: string): LotsStaffRow {
  return {
    id,
    title,
    lotNumber: 1,
    thumbnailUrl: null,
    artist: null,
    saleTitle: "Modern British",
    saleHref: "/admin/sales/sale_1",
    context: "Lot 1",
    statusCode: "active",
    status: { label: "Live", tone: "success" },
    auctionType: "timed",
    estimate: "£2,000–£3,000",
    hammer: null,
    startingFrom: null,
    endsAt: "2026-11-20T18:00:00.000Z",
    addedAt: "2026-11-01T09:00:00.000Z",
    href: `/admin/lots/${id}`,
    editHref: `/admin/lots/${id}/edit`,
    photos: 0,
    inDraftSale: false,
    canDelete: false,
    hasWinner: false,
    withdrawalRequestedAt: null,
  } as LotsStaffRow;
}

function renderList(patch: Partial<LotsStaffListProps> = {}) {
  const props: LotsStaffListProps = {
    rows: [lot("lot_1", "Downs after rain"), lot("lot_2", "Harbour at dusk")],
    search: { status: "active", sort: "endingAsc", offset: "50" },
    views: [],
    activeLens: "all",
    attention: [],
    metrics: [],
    metricsPeriod: "All lots",
    filterChips: [],
    filterOptions: { sales: [], artists: [], categories: [] },
    pageSize: 50,
    pagination: null,
    canManageCatalog: false,
    canManageAuction: false,
    canDecideWithdrawals: false,
    exportFilters: {},
    listError: null,
    filtered: true,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <LotsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const IN_LIST = "?list=status%3Dactive%26sort%3DendingAsc%26offset%3D50";

describe("LotsStaffList", () => {
  beforeEach(resetRowLinks);

  it("opens a lot's page from its row, keeping the list for Previous, Next and Back", () => {
    renderList();
    expectRowOpensPage({
      title: /Downs after rain/,
      href: `/admin/lots/lot_1${IN_LIST}`,
      background: "£2,000–£3,000",
    });
  });

  it("has no quick-view panel any more", () => {
    renderList({ search: { lot: "lot_1" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An old `?lot=` is not part of the list a record remembers.
    expect(
      within(rowOf(/Harbour at dusk/))
        .getAllByRole("link", { name: /Harbour at dusk/ })[0]
        ?.getAttribute("href"),
    ).toBe("/admin/lots/lot_2");
  });

  it("keeps other links in the row as their own links", () => {
    renderList();
    const sale = within(rowOf(/Downs after rain/)).getByRole("link", { name: "Modern British" });
    expect(sale).toHaveAttribute("href", "/admin/sales/sale_1");
  });
});

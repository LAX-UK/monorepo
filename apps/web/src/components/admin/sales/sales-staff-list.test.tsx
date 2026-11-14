import type { SalesStaffRow } from "@/lib/admin/sales/sales-staff-list.vm";
import { expectRowOpensPage, resetRowLinks, rowOf } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SalesStaffList, type SalesStaffListProps } from "./sales-staff-list";

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/sales",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/exports/export-jobs-provider", () => ({
  useExportJobs: () => ({ startExport: vi.fn(), jobs: [] }),
}));

function sale(id: string, title: string): SalesStaffRow {
  return {
    id,
    title,
    coverImageUrl: null,
    statusCode: "draft",
    status: { label: "Draft", tone: "neutral" },
    delivery: "Online",
    saleroom: false,
    lotCount: 12,
    context: "Online · 12 lots",
    startsAt: "2026-11-20T18:00:00.000Z",
    endsAt: null,
    addedAt: "2026-11-01T09:00:00.000Z",
    href: `/admin/sales/${id}`,
    editHref: `/admin/sales/${id}/edit`,
    publicHref: `/sales/${id}`,
    canDelete: false,
  };
}

function renderList(patch: Partial<SalesStaffListProps> = {}) {
  const props: SalesStaffListProps = {
    rows: [sale("sale_1", "Autumn Contemporary"), sale("sale_2", "Winter Prints")],
    search: { lens: "upcoming", sort: "startAsc", offset: "50" },
    views: [],
    activeLens: "upcoming",
    attention: [],
    metrics: [],
    filterChips: [],
    pageSize: 50,
    pagination: null,
    canManageSales: false,
    exportFilters: {},
    listError: null,
    filtered: true,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <SalesStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const IN_LIST = "?list=lens%3Dupcoming%26sort%3DstartAsc%26offset%3D50";

describe("SalesStaffList", () => {
  beforeEach(resetRowLinks);

  it("opens a sale's page from its row, keeping the list for Previous, Next and Back", () => {
    renderList();
    expectRowOpensPage({
      title: /Autumn Contemporary/,
      href: `/admin/sales/sale_1${IN_LIST}`,
      background: "Draft",
    });
  });

  it("has no quick-view panel any more", () => {
    renderList({ search: { sale: "sale_1" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An old `?sale=` is not part of the list a record remembers.
    expect(
      within(rowOf(/Winter Prints/))
        .getAllByRole("link", { name: /Winter Prints/ })[0]
        ?.getAttribute("href"),
    ).toBe("/admin/sales/sale_2");
  });
});

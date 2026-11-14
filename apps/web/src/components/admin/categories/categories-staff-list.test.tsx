import type { CategoriesStaffRow } from "@/lib/admin/categories/categories-staff-list.vm";
import { expectRowOpensPage, resetRowLinks, rowOf } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoriesStaffList, type CategoriesStaffListProps } from "./categories-staff-list";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/categories",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin", () => ({
  adminArchiveCategoryResultAction: vi.fn(),
  adminDeleteCategoryResultAction: vi.fn(),
}));
vi.mock("@/lib/auth/capabilities/viewer-capabilities-context", () => ({
  useViewerCapabilities: () => ({ can: () => false }),
}));

function category(id: string, name: string, lots: number): CategoriesStaffRow {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    archived: false,
    status: { label: "Active", tone: "success" },
    depth: 0,
    context: `/${name.toLowerCase()}`,
    lots,
    sales: 0,
    submissions: 0,
    interests: 0,
    assignments: lots,
    sortOrder: 0,
    hasHeroImage: false,
    updatedAt: "2026-11-01T09:00:00.000Z",
    createdAt: "2026-10-01T09:00:00.000Z",
    href: `/admin/categories/${id}`,
    editHref: `/admin/categories/${id}/edit`,
    canDelete: lots === 0,
  };
}

function renderList(patch: Partial<CategoriesStaffListProps> = {}) {
  const props: CategoriesStaffListProps = {
    rows: [category("cat_1", "Ceramics", 12), category("cat_2", "Prints", 3)],
    search: { q: "c", sort: "-lots", offset: "50" },
    views: [],
    activeView: "active",
    metrics: null,
    pageSize: 50,
    pagination: null,
    listError: null,
    filtered: true,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <CategoriesStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const IN_LIST = "?list=q%3Dc%26sort%3D-lots%26offset%3D50";

describe("CategoriesStaffList", () => {
  beforeEach(() => {
    resetRowLinks();
    push.mockClear();
  });

  it("opens a category's page from its row, keeping the list for Previous, Next and Back", () => {
    renderList();
    expectRowOpensPage({
      title: /Ceramics/,
      href: `/admin/categories/cat_1${IN_LIST}`,
      background: "Active",
    });
  });

  it("has no quick-view panel any more", () => {
    renderList({ search: { category: "cat_1" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An old `?category=` is not part of the list a record remembers.
    expect(
      within(rowOf(/Prints/))
        .getAllByRole("link", { name: /Prints/ })[0]
        ?.getAttribute("href"),
    ).toBe("/admin/categories/cat_2");
  });

  it("keeps the sort in the URL: a sortable column header navigates to the sorted list", () => {
    renderList({ search: { q: "c", sort: "-lots" } });
    const lots = screen.getByRole("columnheader", { name: /Lots/ });
    expect(lots).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(within(lots).getByRole("button"));
    expect(push).toHaveBeenLastCalledWith("/admin/categories?q=c&sort=lots", { scroll: false });

    fireEvent.click(
      within(screen.getByRole("columnheader", { name: /Sales/ })).getByRole("button"),
    );
    expect(push).toHaveBeenLastCalledWith("/admin/categories?q=c&sort=-sales", { scroll: false });
  });
});

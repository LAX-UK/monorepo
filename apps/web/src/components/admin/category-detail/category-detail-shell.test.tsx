import { CategoryDetailShell } from "@/components/admin/category-detail/category-detail-shell";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/categories/c1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/admin/admin-pin-page-button", () => ({
  AdminPinPageButton: () => null,
}));

vi.mock("@/components/admin/category-detail/category-destructive-panel", () => ({
  CategoryDestructivePanel: () => <section aria-label="Lifecycle">Lifecycle panel</section>,
}));

vi.mock("@/components/admin/catalog", () => ({
  CatalogBreadcrumbs: () => null,
  CatalogDetailMobileMeta: () => null,
  CatalogDetailShell: ({
    children,
    stickySubnav,
  }: {
    children?: React.ReactNode;
    stickySubnav?: React.ReactNode;
  }) => (
    <div>
      {stickySubnav}
      {children}
    </div>
  ),
  CatalogDetailStickyMiniBar: ({ items }: { items: { id: string; label: string }[] }) => (
    <div data-testid="mini-bar">{items.map((item) => item.label).join(", ")}</div>
  ),
  CatalogDetailTabNav: ({ tabs }: { tabs: { label: string }[] }) => (
    <nav>{tabs.map((tab) => tab.label).join(" | ")}</nav>
  ),
  CatalogPostCreateSessionRoot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CatalogWhatsNextBanner: () => null,
}));

const baseCategory = {
  id: "c1",
  name: "Paintings",
  slug: "paintings",
  description: null,
  archived: false,
  sortOrder: 0,
  parentId: null,
  heroImageKey: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  usage: { lots: 3, sales: 1, submissions: 2, interests: 0, total: 6 },
};

describe("CategoryDetailShell", () => {
  it("uses subcategory tab label and a two-item sticky mini bar", () => {
    render(
      <CategoryDetailShell
        categoryId="c1"
        category={baseCategory}
        directChildCount={2}
        descendantCount={5}
        lotCount={3}
      >
        <p>Overview content</p>
      </CategoryDetailShell>,
    );

    expect(screen.getByText(/Subcategories \(5\)/)).toBeInTheDocument();
    expect(screen.getByTestId("mini-bar")).toHaveTextContent("Lots, Status");
    expect(screen.getByLabelText("Lifecycle")).toBeInTheDocument();
  });
});

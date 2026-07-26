import { AdminCategoriesBoard } from "@/components/admin/admin-categories-board";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin", () => ({
  adminArchiveCategoryResultAction: vi.fn(),
  adminDeleteCategoryResultAction: vi.fn(),
}));

vi.mock("@/lib/actions/admin/field-updates", () => ({
  adminUpdateCategoryNameFieldAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@auction/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@auction/ui")>();
  return {
    ...actual,
    InlineActionMenu: ({
      items,
      label,
    }: {
      items: readonly { type: string; label: string; onSelect?: () => void; disabled?: boolean }[];
      label: string;
    }) => (
      <div>
        <span>{label}</span>
        {items
          .filter((item) => item.type === "item")
          .map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => item.onSelect?.()}
            >
              {item.label}
            </button>
          ))}
      </div>
    ),
  };
});

vi.mock("@/components/layout/density-provider", () => ({
  useTableDensity: () => ({ density: "comfortable" as const }),
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
  usage: { lots: 1, sales: 0, submissions: 0, total: 1 },
};

describe("AdminCategoriesBoard", () => {
  it("renders hierarchical table rows with usage columns", () => {
    render(
      <AdminCategoriesBoard
        categories={[
          baseCategory,
          {
            ...baseCategory,
            id: "c2",
            name: "Oil",
            slug: "oil",
            parentId: "c1",
            usage: { lots: 2, sales: 1, submissions: 0, total: 3 },
          },
        ]}
      />,
    );

    const table = screen.getByRole("table", { name: "Categories" });
    expect(table).toBeInTheDocument();
    expect(within(table).getByText("Paintings")).toBeInTheDocument();
    expect(within(table).getByText("Oil")).toBeInTheDocument();
    expect(within(table).getByText("Lots")).toBeInTheDocument();
  });

  it("omits delete from the action menu when category is in use", () => {
    render(<AdminCategoriesBoard categories={[baseCategory]} />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("opens confirmation before archive", async () => {
    const unused = {
      ...baseCategory,
      id: "c2",
      slug: "sculpture",
      usage: { lots: 0, sales: 0, submissions: 0, total: 0 },
    };
    render(<AdminCategoriesBoard categories={[unused]} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = screen.getByRole("dialog", { name: "Archive this category?" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("sculpture")).toBeInTheDocument();
  });

  it("shows delete for unused categories and renders usage and status columns", () => {
    const unused = {
      ...baseCategory,
      id: "c2",
      name: "Sculpture",
      slug: "sculpture",
      archived: true,
      usage: { lots: 0, sales: 0, submissions: 0, total: 0 },
    };
    render(<AdminCategoriesBoard categories={[baseCategory, unused]} />);

    const table = screen.getByRole("table", { name: "Categories" });
    expect(within(table).getByText("1")).toBeInTheDocument();
    expect(within(table).getAllByText("Active")).toHaveLength(1);
    expect(within(table).getByText("Archived")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("renders pagination controls when provided", () => {
    render(
      <AdminCategoriesBoard
        categories={[baseCategory]}
        listTotalCount={25}
        pagination={{
          offset: 20,
          limit: 20,
          countOnPage: 5,
          prevHref: "/admin/categories?offset=0",
          nextHref: null,
        }}
      />,
    );

    expect(screen.getAllByRole("link", { name: "Previous page" })[0]).toHaveAttribute(
      "href",
      "/admin/categories?offset=0",
    );
    expect(screen.getByText("25")).toBeInTheDocument();
  });
});

import { CategoriesMobileList } from "@/components/admin/categories-board/mobile-list";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/admin/category-form", () => ({
  AdminCategoryForm: () => <div>Category form</div>,
}));

const stamp = new Date("2024-01-01T00:00:00.000Z");

const baseCategory = {
  id: "c1",
  name: "Paintings",
  slug: "paintings",
  description: null,
  archived: false,
  sortOrder: 0,
  parentId: null,
  heroImageKey: null,
  createdAt: stamp,
  updatedAt: stamp,
  usage: { lots: 1, sales: 2, submissions: 3, interests: 0, total: 6 },
};

describe("CategoriesMobileList", () => {
  it("renders cards with usage and quick edit", () => {
    render(
      <CategoriesMobileList
        categories={[
          baseCategory,
          {
            ...baseCategory,
            id: "c2",
            name: "Oil",
            slug: "oil",
            parentId: "c1",
            archived: true,
          },
        ]}
      />,
    );

    expect(screen.getAllByText("1 lots · 2 sales · 3 submissions")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Quick edit" })).toHaveLength(2);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("filters cards by query", () => {
    render(
      <CategoriesMobileList
        categories={[
          baseCategory,
          { ...baseCategory, id: "c2", name: "Sculpture", slug: "sculpture" },
        ]}
        query="sculpt"
      />,
    );

    expect(screen.queryByText("Paintings")).not.toBeInTheDocument();
    expect(screen.getByText("Sculpture")).toBeInTheDocument();
  });

  it("opens the quick edit sheet", () => {
    render(<CategoriesMobileList categories={[baseCategory]} />);
    fireEvent.click(screen.getByRole("button", { name: "Quick edit" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Category form")).toBeInTheDocument();
  });
});

import { CategoryDestructivePanel } from "@/components/admin/category-detail/category-destructive-panel";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/actions/admin", () => ({
  adminArchiveCategoryResultAction: vi.fn(),
  adminDeleteCategoryResultAction: vi.fn(),
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
  usage: { lots: 0, sales: 0, submissions: 0, total: 0 },
};

describe("CategoryDestructivePanel", () => {
  it("offers delete for unused categories", () => {
    render(<CategoryDestructivePanel category={baseCategory} />);
    expect(screen.getByRole("button", { name: /delete category/i })).toBeInTheDocument();
  });

  it("hides delete when category is in use", () => {
    render(
      <CategoryDestructivePanel
        category={{
          ...baseCategory,
          usage: { lots: 1, sales: 0, submissions: 0, total: 1 },
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /delete category/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /archive category/i })).toBeInTheDocument();
  });

  it("opens typed confirmation for archive", () => {
    render(<CategoryDestructivePanel category={baseCategory} />);
    fireEvent.click(screen.getByRole("button", { name: /archive category/i }));
    expect(screen.getByRole("dialog", { name: "Archive this category?" })).toBeInTheDocument();
    expect(screen.getByText("paintings")).toBeInTheDocument();
  });
});

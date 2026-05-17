import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminCategoriesBoard } from "./admin-categories-board";

vi.mock("@/lib/actions/admin", () => ({
  adminArchiveCategoryResultAction: vi.fn(),
  adminDeleteCategoryResultAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
  usage: { lots: 1, sales: 0, submissions: 0, total: 1 },
};

describe("AdminCategoriesBoard", () => {
  it("shows why delete is hidden when category is in use", () => {
    render(<AdminCategoriesBoard categories={[baseCategory]} />);
    expect(screen.getByText(/Delete hidden — in use/)).toBeInTheDocument();
  });

  it("opens confirmation before archive", () => {
    const unused = {
      ...baseCategory,
      id: "c2",
      slug: "sculpture",
      usage: { lots: 0, sales: 0, submissions: 0, total: 0 },
    };
    render(<AdminCategoriesBoard categories={[unused]} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("dialog", { name: "Archive this category?" })).toBeInTheDocument();
    expect(screen.getByText("sculpture")).toBeInTheDocument();
  });
});

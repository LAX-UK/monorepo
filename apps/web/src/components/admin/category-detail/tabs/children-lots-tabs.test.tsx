import {
  CategoryChildrenTab,
  CategoryLotsTab,
} from "@/components/admin/category-detail/tabs/children-lots-tabs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("CategoryChildrenTab", () => {
  it("says what will appear when there are no subcategories", () => {
    render(<CategoryChildrenTab categoryId="root" allCategories={[]} />);
    expect(screen.getByText("No subcategories yet")).toBeInTheDocument();
  });
});

describe("CategoryLotsTab", () => {
  it("links to the filtered lots list and says how many are not shown", () => {
    render(
      <CategoryLotsTab
        categoryId="c1"
        lots={[{ id: "l1", title: "Lot one", status: "draft" } as never]}
        totalCount={12}
      />,
    );

    expect(screen.getByRole("link", { name: "View all lots" })).toHaveAttribute(
      "href",
      "/admin/lots?categoryId=c1",
    );
    expect(screen.getByText("Showing 1 of 12 lots.")).toBeInTheDocument();
  });

  it("renders the empty state when no lots exist", () => {
    render(<CategoryLotsTab categoryId="c1" lots={[]} totalCount={0} />);
    expect(screen.getByText("No lots tagged with this category")).toBeInTheDocument();
  });
});

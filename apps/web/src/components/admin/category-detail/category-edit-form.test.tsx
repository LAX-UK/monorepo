import { CategoryEditForm } from "@/components/admin/category-detail/category-edit-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { AdminCategory } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const adminCategoryFormProps: Array<Record<string, unknown>> = [];

vi.mock("@/components/admin/category-form", () => ({
  AdminCategoryForm: (props: Record<string, unknown>) => {
    adminCategoryFormProps.push(props);
    return <div data-testid="admin-category-form" />;
  },
}));

const category: AdminCategory = {
  id: "cat-1",
  name: "Paintings",
  slug: "paintings",
  parentId: null,
  sortOrder: 0,
  archived: false,
  description: null,
  heroImageKey: null,
  usage: { lots: 2, sales: 1, submissions: 0, interests: 0, total: 3 },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("CategoryEditForm", () => {
  it("renders a single form surface with sidebar wizard presentation", () => {
    adminCategoryFormProps.length = 0;

    render(
      <CategoryEditForm
        category={category}
        allCategories={[category]}
        cancelHref="/admin/categories/cat-1"
      />,
    );

    expect(screen.getByTestId("admin-category-form")).toBeInTheDocument();
    expect(screen.queryByText(/Usage/i)).not.toBeInTheDocument();
    expect(adminCategoryFormProps.at(-1)).toMatchObject({
      mode: "edit",
      categoryId: "cat-1",
      slug: "paintings",
      htmlFormId: CATALOG_FORM_IDS.category,
      wizardLayout: "sidebar",
      preventNavigateAfterSave: true,
      cancelHref: "/admin/categories/cat-1",
    });
  });
});

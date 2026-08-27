import { CategoryCreateForm } from "@/components/admin/category-detail/category-create-form";
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
  usage: { lots: 0, sales: 0, submissions: 0, interests: 0, total: 0 },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("CategoryCreateForm", () => {
  it("renders sidebar wizard create form with external submit id", () => {
    adminCategoryFormProps.length = 0;

    render(<CategoryCreateForm allCategories={[category]} />);

    expect(screen.getByTestId("admin-category-form")).toBeInTheDocument();
    expect(adminCategoryFormProps.at(-1)).toMatchObject({
      mode: "create",
      htmlFormId: CATALOG_FORM_IDS.category,
      wizardLayout: "sidebar",
      cancelHref: "/admin/categories",
    });
    expect(adminCategoryFormProps.at(-1)).not.toHaveProperty("preventNavigateAfterSave", true);
  });
});

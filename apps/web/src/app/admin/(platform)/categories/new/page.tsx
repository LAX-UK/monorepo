import { CategoryCreateForm } from "@/components/admin/category-detail/category-create-form";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { loadAdminCategoryCreatePage } from "@/lib/admin/categories/load-category-create-page";
import { FormPage, Notice } from "@auction/staff-ui";

export default async function AdminCategoryNewPage() {
  const page = await loadAdminCategoryCreatePage();

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[{ label: "Categories", href: "/admin/categories" }, { label: "New category" }]}
        />
      }
      title="New category"
      description="Add a category that sales, lots and submissions can use. Archive a category that is still in use rather than deleting it."
    >
      {page.setupError ? (
        <Notice tone="danger" alert title="The category cannot be created yet">
          {page.setupError}
        </Notice>
      ) : (
        <CategoryCreateForm allCategories={page.allCategories} />
      )}
    </FormPage>
  );
}

import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogBreadcrumbs, CatalogFormShell } from "@/components/admin/catalog";
import { CategoryCreateForm } from "@/components/admin/category-detail/category-create-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminCategoryCreatePage } from "@/lib/admin/categories/load-category-create-page";

export default async function AdminCategoryNewPage() {
  const page = await loadAdminCategoryCreatePage();

  return (
    <CatalogFormShell
      layout="wizard"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Categories", href: "/admin/categories" }, { label: "New" }]}
        />
      }
      title="New category"
      description="Create taxonomy used by sales, lots, and submissions. Archive categories that remain in use instead of deleting them."
      {...(page.setupError
        ? {
            mobileActions: [
              {
                id: "back" as const,
                label: "Back to categories",
                variant: "secondary" as const,
                href: "/admin/categories",
              },
            ],
          }
        : {
            wizardMobile: {
              formId: CATALOG_FORM_IDS.category,
              submitLabel: "Create category",
              cancelHref: "/admin/categories",
            },
          })}
    >
      {page.setupError ? (
        <AdminListAlert title="Cannot create category">{page.setupError}</AdminListAlert>
      ) : (
        <CategoryCreateForm allCategories={page.allCategories} />
      )}
    </CatalogFormShell>
  );
}

import { CatalogBreadcrumbs, CatalogFormShell } from "@/components/admin/catalog";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { CategoryEditForm } from "@/components/admin/category-detail/category-edit-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminCategoryEditPage } from "@/lib/admin/categories/load-category-edit-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminCategoryEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = await loadAdminCategoryEditPage(id);

  return (
    <CatalogFormShell
      className="max-w-7xl"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Categories", href: "/admin/categories" },
            { label: page.category.name, href: page.overviewHref },
            { label: "Edit" },
          ]}
        />
      }
      title="Edit category"
      description="Update taxonomy placement, presentation, and archive state. Delete unused categories from the detail page when no lots, sales, or submissions reference them."
      wizardMobile={{
        formId: CATALOG_FORM_IDS.category,
        submitLabel: "Save category",
        cancelHref: page.overviewHref,
        alwaysShowSubmit: true,
      }}
      mobileActions={[
        {
          id: "save",
          label: "Save changes",
          variant: "primary",
          htmlForm: CATALOG_FORM_IDS.category,
        },
        {
          id: "cancel",
          label: "Cancel",
          variant: "secondary",
          href: page.overviewHref,
        },
      ]}
    >
      <CatalogDetailActionError error={sp.error} title="Could not save category" />
      <CategoryEditForm
        category={page.category}
        allCategories={page.allCategories}
        cancelHref={page.overviewHref}
      />
    </CatalogFormShell>
  );
}

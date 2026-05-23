import { CatalogBreadcrumbs, CatalogFormShell } from "@/components/admin/catalog";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import { CategoryEditForm } from "@/components/admin/category-detail/category-edit-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminCategoryDetail } from "@/lib/admin/load-category-detail";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminCategoryEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const category = await loadAdminCategoryDetail(id);
  const allCategories = await getAdminCategoryList({ includeArchived: true });
  const overviewHref = categoryDetailTabHref(id, "overview");

  return (
    <CatalogFormShell
      className="max-w-7xl"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Categories", href: "/admin/categories" },
            { label: category.name, href: overviewHref },
            { label: "Edit" },
          ]}
        />
      }
      title="Edit category"
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
          href: overviewHref,
        },
      ]}
    >
      <CatalogDetailActionError error={sp.error} title="Could not save category" />
      <CategoryEditForm
        category={category}
        allCategories={allCategories}
        cancelHref={overviewHref}
      />
    </CatalogFormShell>
  );
}

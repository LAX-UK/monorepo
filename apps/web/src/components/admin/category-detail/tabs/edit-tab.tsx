import { CatalogFormShell } from "@/components/admin/catalog";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import { AdminCategoryForm } from "@/components/admin/category-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { AdminCategory } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

type Props = {
  category: AdminCategory;
  allCategories: AdminCategory[];
};

export function CategoryEditTab({ category, allCategories }: Props) {
  return (
    <CatalogFormShell
      className="!max-w-none pb-28 md:pb-8"
      breadcrumbs={
        <Link
          href={categoryDetailTabHref(category.id, "overview")}
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← {category.name}
        </Link>
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
          href: categoryDetailTabHref(category.id, "overview"),
        },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Surface variant="card">
          <div className="pt-6">
            <AdminCategoryForm
              mode="edit"
              categoryId={category.id}
              categories={allCategories}
              preventNavigateAfterSave
              cancelHref={categoryDetailTabHref(category.id, "overview")}
              htmlFormId={CATALOG_FORM_IDS.category}
              defaultValues={{
                name: category.name,
                slug: category.slug,
                description: category.description ?? "",
                parentId: category.parentId,
                sortOrder: category.sortOrder,
                archived: category.archived,
                heroImageKey: category.heroImageKey ?? null,
              }}
            />
          </div>
        </Surface>

        <Surface variant="card">
          <h3 className="font-headline text-base font-semibold text-on-surface">Usage</h3>
          <div className="space-y-3 text-sm text-on-surface-variant">
            <p>Lots: {category.usage.lots}</p>
            <p>Sales: {category.usage.sales}</p>
            <p>Submissions: {category.usage.submissions}</p>
            <p className="font-semibold text-on-surface">Total: {category.usage.total}</p>
            <p>
              {category.usage.total > 0
                ? "Used categories should be archived to preserve catalog history."
                : "Unused categories can be deleted from the category tree."}
            </p>
          </div>
        </Surface>
      </div>
    </CatalogFormShell>
  );
}

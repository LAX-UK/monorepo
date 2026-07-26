import { AdminCategoryForm } from "@/components/admin/category-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { AdminCategory } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  category: AdminCategory;
  allCategories: AdminCategory[];
  cancelHref: string;
};

export function CategoryEditForm({ category, allCategories, cancelHref }: Props) {
  return (
    <Surface variant="card" padding="md">
      <AdminCategoryForm
        mode="edit"
        categoryId={category.id}
        slug={category.slug}
        categories={allCategories}
        preventNavigateAfterSave
        cancelHref={cancelHref}
        htmlFormId={CATALOG_FORM_IDS.category}
        wizardLayout="sidebar"
        defaultValues={{
          name: category.name,
          description: category.description ?? "",
          parentId: category.parentId,
          sortOrder: category.sortOrder,
          archived: category.archived,
          heroImageKey: category.heroImageKey ?? null,
        }}
      />
    </Surface>
  );
}

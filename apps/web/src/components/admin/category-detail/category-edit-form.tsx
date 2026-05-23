import { CategoryUsagePanel } from "@/components/admin/category-detail/category-usage-panel";
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Surface variant="card" padding="md">
        <AdminCategoryForm
          mode="edit"
          categoryId={category.id}
          slug={category.slug}
          categories={allCategories}
          preventNavigateAfterSave
          cancelHref={cancelHref}
          htmlFormId={CATALOG_FORM_IDS.category}
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

      <Surface variant="card" padding="md">
        <CategoryUsagePanel categoryId={category.id} usage={category.usage} compact />
      </Surface>
    </div>
  );
}

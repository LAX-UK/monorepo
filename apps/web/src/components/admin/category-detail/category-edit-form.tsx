import { AdminCategoryForm } from "@/components/admin/category-form";
import type { AdminCategory } from "@auction/types";

type Props = {
  category: AdminCategory;
  allCategories: AdminCategory[];
  cancelHref: string;
};

export function CategoryEditForm({ category, allCategories, cancelHref }: Props) {
  return (
    <AdminCategoryForm
      mode="edit"
      categoryId={category.id}
      name={category.name}
      slug={category.slug}
      categories={allCategories}
      cancelHref={cancelHref}
      defaultValues={{
        name: category.name,
        description: category.description ?? "",
        parentId: category.parentId,
        sortOrder: category.sortOrder,
        archived: category.archived,
        heroImageKey: category.heroImageKey ?? null,
      }}
    />
  );
}

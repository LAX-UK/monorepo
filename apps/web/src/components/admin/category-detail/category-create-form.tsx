import { AdminCategoryForm } from "@/components/admin/category-form";
import type { AdminCategory } from "@auction/types";

type Props = {
  allCategories: AdminCategory[];
};

export function CategoryCreateForm({ allCategories }: Props) {
  return (
    <AdminCategoryForm
      mode="create"
      categories={allCategories}
      cancelHref="/admin/categories"
      defaultValues={{
        name: "",
        description: "",
        parentId: null,
        sortOrder: 0,
        archived: false,
        heroImageKey: null,
      }}
    />
  );
}

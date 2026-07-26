import { AdminCategoryForm } from "@/components/admin/category-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { AdminCategory } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  allCategories: AdminCategory[];
};

export function CategoryCreateForm({ allCategories }: Props) {
  return (
    <Surface variant="card" padding="md">
      <AdminCategoryForm
        mode="create"
        categories={allCategories}
        cancelHref="/admin/categories"
        htmlFormId={CATALOG_FORM_IDS.category}
        wizardLayout="sidebar"
        defaultValues={{
          name: "",
          description: "",
          parentId: null,
          sortOrder: 0,
          archived: false,
          heroImageKey: null,
        }}
      />
    </Surface>
  );
}

import { CategoryEditForm } from "@/components/admin/category-detail/category-edit-form";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { loadAdminCategoryEditPage } from "@/lib/admin/categories/load-category-edit-page";
import { FormPage } from "@auction/staff-ui";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryEditPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminCategoryEditPage(id);

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[
            { label: "Categories", href: "/admin/categories" },
            { label: page.category.name, href: page.overviewHref },
            { label: "Edit" },
          ]}
        />
      }
      title={`Edit ${page.category.name}`}
      description="Change where the category sits in the tree, its picture and copy, or archive it. A category nothing uses can be deleted from its page."
    >
      <CategoryEditForm
        category={page.category}
        allCategories={page.allCategories}
        cancelHref={page.overviewHref}
      />
    </FormPage>
  );
}

import { AdminCategoryForm } from "@/components/admin/admin-category-form";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";
import { Card, CardContent } from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";

export default async function NewAdminCategoryPage() {
  const categories = await getAdminCategoryList({ includeArchived: true });

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="New category"
        description="Create a category that staff can assign to sales, lots, and seller submissions."
      />
      <Card>
        <CardContent className="pt-6">
          <AdminCategoryForm
            mode="create"
            categories={categories}
            defaultValues={{
              name: "",
              slug: "",
              description: "",
              parentId: null,
              sortOrder: 0,
            }}
          />
        </CardContent>
      </Card>
    </AppScreen>
  );
}

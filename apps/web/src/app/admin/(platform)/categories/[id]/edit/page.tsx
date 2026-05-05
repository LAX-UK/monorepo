import { AdminCategoryForm } from "@/components/admin/admin-category-form";
import { getAdminCategoryById, getAdminCategoryList } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { notFound } from "next/navigation";

export default async function EditAdminCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [category, categories] = await Promise.all([
    getAdminCategoryById(id),
    getAdminCategoryList({ includeArchived: true }),
  ]);

  if (!category) notFound();

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title={`Edit ${category.name}`}
        description="Update taxonomy copy, hierarchy, sort order, and archived state."
      />

      {sp.error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save category</AlertTitle>
          <AlertDescription>{decodeURIComponent(sp.error)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardContent className="pt-6">
            <AdminCategoryForm
              mode="edit"
              categoryId={category.id}
              categories={categories}
              defaultValues={{
                name: category.name,
                slug: category.slug,
                description: category.description ?? "",
                parentId: category.parentId,
                sortOrder: category.sortOrder,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-on-surface-variant">
            <p>Lots: {category.usage.lots}</p>
            <p>Sales: {category.usage.sales}</p>
            <p>Submissions: {category.usage.submissions}</p>
            <p className="font-semibold text-on-surface">Total: {category.usage.total}</p>
            <p>
              {category.usage.total > 0
                ? "Used categories should be archived to preserve catalog history."
                : "Unused categories can be deleted from the category tree."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

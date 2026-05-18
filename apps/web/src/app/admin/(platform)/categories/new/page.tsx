import { AdminCategoryForm } from "@/components/admin/admin-category-form";
import { AdminEntityFormShell } from "@/components/admin/admin-entity-form-shell";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

export default async function NewAdminCategoryPage() {
  const categories = await getAdminCategoryList({ includeArchived: true });

  return (
    <AdminEntityFormShell
      breadcrumbs={
        <Link
          href="/admin/categories"
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Categories
        </Link>
      }
      title="New category"
      description="Create a category that staff can assign to sales, lots, and seller submissions."
    >
      <Surface variant="card">
        <div className="pt-6">
          <AdminCategoryForm
            mode="create"
            categories={categories}
            defaultValues={{
              name: "",
              slug: "",
              description: "",
              parentId: null,
              sortOrder: 0,
              archived: false,
              heroImageKey: null,
            }}
          />
        </div>
      </Surface>
    </AdminEntityFormShell>
  );
}

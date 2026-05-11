import { AdminCategoriesBoard } from "@/components/admin/admin-categories-board";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { Button } from "@/components/ui/button";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ includeArchived?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.includeArchived === "true";
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  let categories: Awaited<ReturnType<typeof getAdminCategoryList>> = [];
  let listError: string | null = null;

  try {
    categories = await getAdminCategoryList({ includeArchived });
  } catch (e) {
    listError = e instanceof Error ? e.message : "Could not load categories.";
  }

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Categories"
        description="Manage the taxonomy used by sales, lots, and submissions. Archive used categories instead of deleting them."
        actions={
          <Button variant="primary" asChild>
            <Link href="/admin/categories/new">
              <Plus className="size-4" aria-hidden />
              New category
            </Link>
          </Button>
        }
      />

      {error || listError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load categories</AlertTitle>
          <AlertDescription>{listError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/categories"
          className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
            !includeArchived
              ? "bg-primary text-on-primary ring-primary"
              : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/categories?includeArchived=true"
          className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
            includeArchived
              ? "bg-primary text-on-primary ring-primary"
              : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
          }`}
        >
          Include archived
        </Link>
      </div>

      {!listError && categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create categories before cataloguing lots or building sale landing pages."
          action={
            <Button variant="primary" asChild>
              <Link href="/admin/categories/new">
                <Plus className="size-4" aria-hidden />
                New category
              </Link>
            </Button>
          }
        />
      ) : null}

      {!listError && categories.length > 0 ? (
        <AdminCategoriesBoard categories={categories} />
      ) : null}
    </AppScreen>
  );
}

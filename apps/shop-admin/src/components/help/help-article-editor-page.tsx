import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HelpArticleEditor } from "@/components/help/help-article-editor.client";
import type { HelpArticleDetail } from "@/lib/help-forms";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import type { HelpAdminCategoryRow } from "@auction/shop-contracts";
import { Button, EmptyState, PageHeader } from "@auction/ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const TITLE = "Help centre";

/**
 * The editor route for one question, or for a new draft when `id` is null. A new question
 * starts in `categoryId` when the list it was opened from was filtered to one category.
 */
export async function HelpArticleEditorPage({
  id,
  categoryId,
}: {
  id: string | null;
  categoryId: string | null;
}) {
  const [detailResult, categoriesResult] = await Promise.all([
    id ? fetchAdminJson<HelpArticleDetail>(`help/articles/${id}`) : null,
    fetchAdminJson<{ items: HelpAdminCategoryRow[] }>("help/categories"),
  ]);
  if (detailResult?.status === "unauthorized" || categoriesResult.status === "unauthorized") {
    redirect("/login");
  }
  if (detailResult?.status === "not_found") notFound();
  const failed = [detailResult, categoriesResult].find(
    (result) => result && result.status !== "ok",
  );
  if (failed && failed.status !== "ok") {
    return <AdminFailedPage title={TITLE} status={failed.status} />;
  }
  if (categoriesResult.status !== "ok") return null;

  const categories = categoriesResult.data.items;
  const detail = detailResult?.status === "ok" ? detailResult.data : null;
  const title = detail?.question ?? "New question";

  if (categories.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={title} />
        <EmptyState
          headingLevel="h2"
          title="Create a category first"
          description="Every question belongs to a category, so add one before writing questions."
          action={
            <Button asChild>
              <Link href="/help/categories">Go to categories</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const defaultCategoryId =
    categories.find((category) => category.id === categoryId)?.id ?? categories[0]?.id ?? "";
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={<AdminBreadcrumbs list={{ label: TITLE, href: "/help" }} current={title} />}
        title={title}
        description={detail ? `/help/${detail.slug}` : "Saved as a draft until you publish it."}
      />
      <HelpArticleEditor
        key={id ?? "new"}
        detail={detail}
        categories={categories.map((category) => ({ value: category.id, label: category.title }))}
        defaultCategoryId={defaultCategoryId}
        artPublicUrl={getShopAdminContainer().config.artPublicUrl ?? null}
      />
    </div>
  );
}

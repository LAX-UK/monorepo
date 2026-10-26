import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HelpArticleEditor } from "@/components/help/help-article-editor.client";
import { HelpFirstCategory } from "@/components/help/help-first-category.client";
import type { HelpArticleDetail } from "@/lib/help-forms";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import type { HelpAdminCategoryRow } from "@auction/shop-contracts";
import { PageHeader } from "@auction/staff-ui";
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

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          breadcrumbs={
            <AdminBreadcrumbs list={{ label: TITLE, href: "/help" }} current="New question" />
          }
          title="New question"
        />
        <HelpFirstCategory />
      </div>
    );
  }

  const defaultCategoryId =
    categories.find((category) => category.id === categoryId)?.id ?? categories[0]?.id ?? "";
  return (
    <HelpArticleEditor
      key={id ?? "new"}
      detail={detail}
      categories={categories.map((category) => ({ value: category.id, label: category.title }))}
      defaultCategoryId={defaultCategoryId}
      artPublicUrl={getShopAdminContainer().config.artPublicUrl ?? null}
    />
  );
}

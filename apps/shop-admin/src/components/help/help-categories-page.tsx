import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { HelpCategoriesManager } from "@/components/help/help-categories-manager.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { toHelpCategoryListRow } from "@/server/domain/help-list.vm";
import type { HelpAdminCategoryRow } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

const TITLE = "Categories";

/** Categories in the order lax.art shows them; the order is changed here with Move up and Move down. */
export async function HelpCategoriesPage() {
  const result = await fetchAdminJson<{ items: HelpAdminCategoryRow[] }>("help/categories");
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title={TITLE} status={result.status} />;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs list={{ label: "Help centre", href: "/help" }} current={TITLE} />
        }
        title={TITLE}
        description="Questions are grouped by category on lax.art. Only published categories appear."
      />
      <HelpCategoriesManager rows={result.data.items.map(toHelpCategoryListRow)} />
    </div>
  );
}

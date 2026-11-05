import { PurchaseProblemsList } from "@/components/admin/purchase-problems/purchase-problems-list";
import { loadAdminPurchaseProblemsPage } from "@/lib/admin/purchase-problems/load-purchase-problems-page";
import { buildPurchaseProblemsChips } from "@/lib/admin/purchase-problems/purchase-problems-search";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { PURCHASE_PROBLEMS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Purchase problems",
  "Problems buyers report with a paid purchase, with who owns each and where it stands.",
);

export default async function AdminPurchaseProblemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminCapability(PURCHASE_PROBLEMS_ACCESS, "/admin/purchase-problems");
  const sp = await searchParams;
  const model = await loadAdminPurchaseProblemsPage(sp);
  const chips = buildPurchaseProblemsChips(model.filters, sp, {
    sale: (value) => model.page?.sales.find((sale) => sale.id === value)?.title ?? "Unknown sale",
    assignee: (value) =>
      value === "unassigned"
        ? "Unassigned"
        : (model.assignees.find((person) => person.id === value)?.name ?? "Former staff member"),
  });

  return (
    <PurchaseProblemsList
      page={model.page}
      search={sp}
      filters={model.filters}
      chips={chips}
      assignees={model.assignees}
      pagination={model.pagination}
      loadError={model.loadError}
      filtered={model.filtered}
      now={new Date().toISOString()}
    />
  );
}

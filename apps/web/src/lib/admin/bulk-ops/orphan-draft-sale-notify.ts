import { isBulkLotsResult } from "@/lib/admin/catalog-bulk-result-handler";
import { adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import { notify } from "@/lib/ui/notify";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function notifyOrphanDraftSales(router: AppRouterInstance, data: unknown): void {
  if (!isBulkLotsResult(data)) return;
  const orphans = data.orphanDraftSales ?? [];
  if (orphans.length === 1) {
    const sale = orphans[0];
    if (sale) {
      notify.action("Draft sale now has no lots", {
        description: `“${sale.title}” — you can delete the sale too.`,
        actionLabel: "View sale",
        onAction: () => router.push(adminSaleHref(sale.id)),
      });
    }
  } else if (orphans.length > 1) {
    notify.warning(
      `${orphans.length} draft sales now have no lots — review them from the sales list.`,
    );
  }
}

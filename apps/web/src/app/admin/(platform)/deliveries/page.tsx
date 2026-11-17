import { DeliveriesList } from "@/components/admin/deliveries/deliveries-list";
import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import { DELIVERIES_PATH } from "@/lib/admin/deliveries/deliveries.vm";
import { loadAdminDeliveriesPage } from "@/lib/admin/deliveries/load-deliveries-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { DELIVERIES_ACCESS, DELIVERIES_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, userHasAccessTo } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  DELIVERIES_COPY.meta.title,
  DELIVERIES_COPY.meta.description,
);

/**
 * Deliveries (docs/design/staff-gaps-delivery-zoho-alerts.md, D1): every won lot a buyer wants
 * delivered. Fulfilment and Administrators work it; read-only staff see it without the actions.
 */
export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminCapability(DELIVERIES_READ_ACCESS, DELIVERIES_PATH);
  const sp = await searchParams;
  const model = await loadAdminDeliveriesPage(sp);
  return (
    <DeliveriesList
      page={model.page}
      search={sp}
      filters={model.filters}
      chips={model.chips}
      selected={model.selected}
      pagination={model.pagination}
      loadError={model.loadError}
      filtered={model.filtered}
      canWork={userHasAccessTo(user.role as UserRole, user.staffRoles, DELIVERIES_ACCESS)}
      now={new Date().toISOString()}
    />
  );
}

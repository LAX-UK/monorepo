import { DealsList } from "@/components/admin/private-sales/deals-list";
import { loadAdminDealsPage } from "@/lib/admin/private-sales/load-deals-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { PRIVATE_SALE_DEALS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Private sales",
  "Works sold by private treaty, from offer to the seller's payout.",
);

export default async function AdminPrivateSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminCapability(PRIVATE_SALE_DEALS_READ_ACCESS, "/admin/private-sales");
  const sp = await searchParams;
  const model = await loadAdminDealsPage(sp);
  return (
    <DealsList
      page={model.page}
      search={sp}
      filters={model.filters}
      pagination={model.pagination}
      loadError={model.loadError}
    />
  );
}

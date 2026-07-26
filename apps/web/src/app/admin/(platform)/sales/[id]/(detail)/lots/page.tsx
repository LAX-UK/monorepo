import { CatalogDetailActionError } from "@/components/admin/catalog";
import { SaleLotsTab } from "@/components/admin/sale-detail/tabs/lots-tab";
import { loadAdminSaleLotsPage } from "@/lib/admin/sales/load-sale-lots-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { SALES_ACCESS, SALE_CATALOG_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleLotsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireAdminCapability(SALE_CATALOG_ACCESS, `/admin/sales/${id}/lots`);
  const canManageAuction = userHasAccessTo(
    user.role as UserRole,
    user.staffRole ?? null,
    SALES_ACCESS,
  );
  const page = await loadAdminSaleLotsPage(id);

  return (
    <>
      <CatalogDetailActionError error={sp.error} />
      <SaleLotsTab
        saleId={page.saleId}
        sale={page.sale}
        lots={page.lots}
        canManageAuction={canManageAuction}
        categories={page.categories}
        englishOnlyAuctionsLocked={isEnglishOnlyAuctionsLocked()}
      />
    </>
  );
}

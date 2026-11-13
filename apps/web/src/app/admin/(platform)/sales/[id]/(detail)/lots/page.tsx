import { SaleLotsTab } from "@/components/admin/sale-detail/tabs/lots-tab";
import { loadAdminSaleLotsPage } from "@/lib/admin/sales/load-sale-lots-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { saleLotsLensFromQuery } from "@/lib/data/view-models/sale-lots-tab.vm";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { SALES_ACCESS, SALE_CATALOG_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ premium?: string | string[] }>;
};

export default async function AdminSaleLotsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const user = await requireAdminCapability(SALE_CATALOG_READ_ACCESS, `/admin/sales/${id}/lots`);
  const canManageAuction = userHasAccessTo(user.role as UserRole, user.staffRoles, SALES_ACCESS);
  const page = await loadAdminSaleLotsPage(id);

  return (
    <SaleLotsTab
      saleId={page.saleId}
      sale={page.sale}
      lots={page.lots}
      canManageAuction={canManageAuction}
      categories={page.categories}
      englishOnlyAuctionsLocked={isEnglishOnlyAuctionsLocked()}
      artistNameById={page.artistNameById}
      initialLens={saleLotsLensFromQuery(query.premium)}
    />
  );
}

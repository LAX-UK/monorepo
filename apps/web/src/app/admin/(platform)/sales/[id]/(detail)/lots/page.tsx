import { CatalogDetailActionError } from "@/components/admin/catalog";
import { SaleLotsTab } from "@/components/admin/sale-detail/tabs/lots-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
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
  const bundle = await loadAdminSaleDetail(id);
  const canAddLots =
    bundle.sale.status === "draft" ||
    bundle.sale.status === "scheduled" ||
    bundle.sale.status === "active";
  const categories =
    canAddLots && bundle.sale.status !== "draft"
      ? await (await getServerCategoryReader()).tree().catch(() => [])
      : [];

  return (
    <>
      <CatalogDetailActionError error={sp.error} />
      <SaleLotsTab
        saleId={id}
        sale={bundle.sale}
        lots={bundle.lots}
        canManageAuction={canManageAuction}
        categories={categories}
        englishOnlyAuctionsLocked={isEnglishOnlyAuctionsLocked()}
      />
    </>
  );
}

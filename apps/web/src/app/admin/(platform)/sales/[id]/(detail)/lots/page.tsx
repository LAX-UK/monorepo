import { CatalogDetailActionError } from "@/components/admin/catalog";
import { SaleLotsTab } from "@/components/admin/sale-detail/tabs/lots-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { getAdminLotList } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleLotsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadAdminSaleDetail(id);
  const draftOrphans = await getAdminLotList({ status: "draft", limit: 100, offset: 0 })
    .then((rows) => rows.filter((l) => l.saleId == null))
    .catch(() => [] as Lot[]);

  return (
    <>
      <CatalogDetailActionError error={sp.error} />
      <SaleLotsTab saleId={id} sale={bundle.sale} lots={bundle.lots} draftOrphans={draftOrphans} />
    </>
  );
}

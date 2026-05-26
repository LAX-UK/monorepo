import { CatalogDetailActionError } from "@/components/admin/catalog";
import { SaleLotsTab } from "@/components/admin/sale-detail/tabs/lots-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleLotsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadAdminSaleDetail(id);

  return (
    <>
      <CatalogDetailActionError error={sp.error} />
      <SaleLotsTab saleId={id} sale={bundle.sale} lots={bundle.lots} />
    </>
  );
}

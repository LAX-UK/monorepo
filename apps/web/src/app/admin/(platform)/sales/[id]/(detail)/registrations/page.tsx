import { isSaleLiveish } from "@/components/admin/sale-detail/sale-detail-helpers";
import { SaleRegistrationsTab } from "@/components/admin/sale-detail/tabs/registrations-tab";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminSaleRegistrations } from "@/lib/data/http/admin.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleRegistrationsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadAdminSaleDetail(id);
  const liveish = isSaleLiveish(bundle.sale);

  const registrationsResult = liveish
    ? await getAdminSaleRegistrations(id)
        .then((rows) => ({ rows, error: null as string | null }))
        .catch((err) => ({
          rows: [],
          error: err instanceof Error ? err.message : "Failed to load registrations.",
        }))
    : { rows: [], error: null as string | null };

  return (
    <SaleRegistrationsTab
      saleId={id}
      sale={bundle.sale}
      liveish={liveish}
      rows={registrationsResult.rows}
      fetchError={registrationsResult.error}
      actionError={sp.error ? safeDecodeAdminErrorParam(sp.error) : null}
    />
  );
}

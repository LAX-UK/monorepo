import { SaleRegistrationsTabSection } from "@/components/admin/sale-registrations-tab-section";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin.server";
import type { Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminSaleRegistrationRow[];
  fetchError: string | null;
  actionError: string | null;
};

export function SaleRegistrationsTab({
  saleId,
  sale,
  liveish,
  rows,
  fetchError,
  actionError,
}: Props) {
  return (
    <SaleRegistrationsTabSection
      saleId={saleId}
      saleStatus={sale.status}
      liveish={liveish}
      rows={rows}
      fetchError={fetchError}
      actionError={actionError}
    />
  );
}

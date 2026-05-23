import { CatalogDetailTabPanel } from "@/components/admin/catalog";
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
    <CatalogDetailTabPanel
      title={sale.deliveryMode === "onsite" ? "Paddle registrations" : "Bidder registrations"}
      description="Approve or reject registration requests before and during the live sale."
      framed={false}
    >
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <SaleRegistrationsTabSection
          saleId={saleId}
          saleStatus={sale.status}
          liveish={liveish}
          rows={rows}
          fetchError={fetchError}
          actionError={actionError}
        />
      </div>
    </CatalogDetailTabPanel>
  );
}

import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { SaleRegistrationsTabSection } from "@/components/admin/sale-registrations-tab-section";
import type { AdminExpectedGuestsSummary } from "@/lib/data/http/admin-expected-guests.server";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin.server";
import type { Sale } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminSaleRegistrationRow[];
  fetchError: string | null;
  actionError: string | null;
  saleCurrency?: string;
  expectedGuests?: AdminExpectedGuestsSummary | null;
};

export function SaleRegistrationsTab({
  saleId,
  sale,
  liveish,
  rows,
  fetchError,
  actionError,
  saleCurrency = "GBP",
  expectedGuests = null,
}: Props) {
  const showPaddleCheckIn = isSaleroomDeliveryMode(sale.deliveryMode);
  return (
    <CatalogDetailTabPanel
      title={showPaddleCheckIn ? "Paddle registrations" : "Bidder registrations"}
      description={
        showPaddleCheckIn
          ? "Approve registrations and assign in-room paddle numbers at check-in."
          : "Approve or reject registration requests before and during the live sale."
      }
      framed={false}
    >
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <SaleRegistrationsTabSection
          saleId={saleId}
          saleStatus={sale.status}
          deliveryMode={sale.deliveryMode}
          liveish={liveish}
          rows={rows}
          fetchError={fetchError}
          actionError={actionError}
          saleCurrency={saleCurrency}
          expectedGuests={expectedGuests}
        />
      </div>
    </CatalogDetailTabPanel>
  );
}

import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { TelephoneBookingsTabSection } from "@/components/admin/telephone-bookings-tab-section";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import type { Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminTelephoneBookingRow[];
  fetchError: string | null;
  actionError: string | null;
};

export function SaleTelephoneBookingsTab({
  saleId,
  sale,
  liveish,
  rows,
  fetchError,
  actionError,
}: Props) {
  return (
    <CatalogDetailTabPanel
      title="Telephone bookings"
      description="Confirm lines, assign clerks, and manage in-progress telephone bidding."
      framed={false}
    >
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <TelephoneBookingsTabSection
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

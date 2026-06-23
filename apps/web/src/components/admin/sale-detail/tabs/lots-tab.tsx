import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { AdminSaleLotQrPrintButton } from "@/components/admin/qr-code/admin-sale-lot-qr-print-button";
import { SaleLotsTabSection } from "@/components/admin/sale-lots-tab-section";
import { saleSetupHref } from "@/lib/admin/sale-setup";
import type { CategoryNode, Lot, Sale } from "@auction/types";
import Link from "next/link";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  canManageAuction?: boolean;
  categories?: CategoryNode[];
  englishOnlyAuctionsLocked?: boolean;
};

export function SaleLotsTab({
  saleId,
  sale,
  lots,
  canManageAuction = false,
  categories = [],
  englishOnlyAuctionsLocked = false,
}: Props) {
  const canEditDraft = sale.status === "draft";
  const canAddLots =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";

  return (
    <CatalogDetailTabPanel
      title="Catalog lots"
      description="Attach, detach, and manage lot status within this sale."
      framed={false}
    >
      <div className="sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border-hairline bg-surface/95 px-1 py-3 backdrop-blur-sm">
        <p className="font-body text-sm text-on-surface-variant">
          <span className="font-medium tabular-nums text-on-surface">{lots.length}</span> lot
          {lots.length === 1 ? "" : "s"} in this sale
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canManageAuction ? (
            <AdminSaleLotQrPrintButton
              lots={lots.map((l) => ({ id: l.id, title: l.title, lotNumber: l.lotNumber }))}
            />
          ) : null}
          {canEditDraft ? (
            <Link
              href={saleSetupHref(saleId, "lots")}
              className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
            >
              Add lots in setup →
            </Link>
          ) : canAddLots ? (
            <a
              href="#add-lot-to-live-sale"
              className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
            >
              Add new lot →
            </a>
          ) : null}
        </div>
      </div>
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <SaleLotsTabSection
          saleId={saleId}
          saleStatus={sale.status}
          deliveryMode={sale.deliveryMode}
          saleStartTime={sale.startTime}
          saleEndTime={sale.endTime}
          canEditDraft={canEditDraft}
          canAddLots={canAddLots}
          categories={categories}
          englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
          canManageAuction={canManageAuction}
          lots={lots.map((l) => ({
            id: l.id,
            title: l.title,
            lotNumber: l.lotNumber,
            status: l.status,
            winnerId: l.winnerId ?? null,
            imageUrl: l.images[0] ?? null,
          }))}
        />
      </div>
    </CatalogDetailTabPanel>
  );
}

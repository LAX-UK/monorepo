import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { SaleLotsTabSection } from "@/components/admin/sale-lots-tab-section";
import { saleSetupHref } from "@/lib/admin/sale-setup";
import type { Lot, Sale } from "@auction/types";
import Link from "next/link";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  draftOrphans: Lot[];
};

export function SaleLotsTab({ saleId, sale, lots, draftOrphans }: Props) {
  const canEdit = sale.status === "draft";

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
        {canEdit ? (
          <Link
            href={saleSetupHref(saleId, "lots")}
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
          >
            Add lots in setup →
          </Link>
        ) : null}
      </div>
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <SaleLotsTabSection
          saleId={saleId}
          saleStatus={sale.status}
          deliveryMode={sale.deliveryMode}
          canEdit={canEdit}
          lots={lots.map((l) => ({
            id: l.id,
            title: l.title,
            lotNumber: l.lotNumber,
            status: l.status,
            imageUrl: l.images[0] ?? null,
          }))}
          draftOrphans={draftOrphans.map((l) => ({ id: l.id, title: l.title }))}
        />
      </div>
    </CatalogDetailTabPanel>
  );
}

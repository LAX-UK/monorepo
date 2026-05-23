import { CatalogInfoCard } from "@/components/admin/catalog";
import { formatDateTime } from "@/lib/ui/format";
import type { Sale } from "@auction/types";

type Props = {
  sale: Sale;
};

export function SaleScheduleTab({ sale }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CatalogInfoCard title="Sale window">
        <dl className="space-y-2 font-body text-sm">
          <div>
            <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Start
            </dt>
            <dd className="tabular-nums text-on-surface">{formatDateTime(sale.startTime)}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              End
            </dt>
            <dd className="tabular-nums text-on-surface">{formatDateTime(sale.endTime)}</dd>
          </div>
          {sale.previewStartTime ? (
            <div>
              <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Preview from
              </dt>
              <dd className="tabular-nums text-on-surface">
                {formatDateTime(sale.previewStartTime)}
              </dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 text-xs text-on-surface-variant">
          Displayed in your browser locale. Cross-check with published catalog copy for the
          canonical timezone.
        </p>
      </CatalogInfoCard>
      <CatalogInfoCard title="Per-lot timing">
        <p className="font-body text-sm text-on-surface-variant">
          {sale.deliveryMode === "onsite"
            ? "Onsite lots typically share the sale window above. Open a lot to adjust its own schedule if needed."
            : "Each online lot has its own start/end. Open the Lots tab to jump to a lot, then edit its schedule on the lot detail page."}
        </p>
      </CatalogInfoCard>
    </div>
  );
}

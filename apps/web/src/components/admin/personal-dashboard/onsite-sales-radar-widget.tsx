import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import {
  type OnsiteSalesRadarRow,
  mapOperationsSnapshotToRadarRow,
} from "@/lib/admin/saleroom/map-operations-snapshot-to-radar-row";
import { LiveBadge } from "@auction/ui/components/live-badge";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type { OnsiteSalesRadarRow };
export { mapOperationsSnapshotToRadarRow };

type Props = {
  rows: OnsiteSalesRadarRow[];
};

export function SaleroomSalesRadarWidget({ rows }: Props) {
  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold text-on-surface">
            Saleroom sales radar
          </h3>
          <p className="font-body text-sm text-on-surface-variant">
            Live hybrid and in-person sales needing attention or currently on the floor.
          </p>
        </div>
        <Link
          href="/admin/saleroom"
          className="inline-flex min-h-9 shrink-0 items-center gap-1 font-label text-xs font-semibold uppercase tracking-widest text-link hover:underline"
        >
          Saleroom
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">
          No saleroom sales need immediate operations attention.
        </p>
      ) : (
        <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
          {rows.map((row) => (
            <li key={row.saleId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={saleDetailTabHref(row.saleId, "operations")}
                    className="font-medium text-link hover:underline"
                  >
                    {row.title}
                  </Link>
                  <SaleDeliveryModeBadge mode={row.deliveryMode} />
                  {row.needsClosing ? (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      Needs closing
                    </span>
                  ) : row.isLiveSession ? (
                    <LiveBadge />
                  ) : null}
                </div>
                <p className="font-body text-xs text-on-surface-variant capitalize">
                  {row.status}
                  {row.currentLotTitle ? <> · On block: {row.currentLotTitle}</> : null}
                  {row.pendingRegistrations > 0 ? (
                    <> · {row.pendingRegistrations} reg pending</>
                  ) : null}
                  {row.pendingTelephone > 0 ? <> · {row.pendingTelephone} tel pending</> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/admin/saleroom/${row.saleId}`}
                  className="font-label text-xs font-semibold uppercase tracking-widest text-link hover:underline"
                >
                  Console
                </Link>
                <Link
                  href={`${saleDetailTabHref(row.saleId, "registrations")}#check-in`}
                  className="font-label text-xs font-semibold uppercase tracking-widest text-link hover:underline"
                >
                  Check in
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

/** @deprecated Use SaleroomSalesRadarWidget */
export const OnsiteSalesRadarWidget = SaleroomSalesRadarWidget;

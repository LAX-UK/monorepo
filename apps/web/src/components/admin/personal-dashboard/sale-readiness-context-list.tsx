import { AdminLiveBidActivity } from "@/components/admin/admin-live-bid-activity";
import type { SaleReadinessSlice } from "@/lib/admin/dashboard/sale-readiness.slice";
import type { AdminSaleReadinessRow } from "@/lib/data/http/admin-sale-readiness.schema";
import Link from "next/link";

type Props = {
  saleReadiness: SaleReadinessSlice;
  activeLotIds: readonly string[];
};

function saleStatusLabel(row: AdminSaleReadinessRow): string {
  if (row.daysToStart != null && row.daysToStart <= 0) return "Live";
  if (row.daysToStart != null && row.daysToStart > 0) return `${row.daysToStart}d to start`;
  return row.status || "Scheduled";
}

export function SaleReadinessContextList({ saleReadiness, activeLotIds }: Props) {
  const pulseData =
    saleReadiness.status === "ready" || saleReadiness.status === "empty"
      ? saleReadiness.data
      : { rows: [] as AdminSaleReadinessRow[], bidsPerMinute: 0, activeSaleroomSessions: 0 };

  return (
    <div className="divide-y divide-shell-stroke">
      <div className="py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-body text-sm font-medium text-on-surface">Saleroom pulse</p>
          {pulseData.activeSaleroomSessions > 0 ? (
            <span className="font-body text-xs text-error">Live</span>
          ) : null}
        </div>
        <AdminLiveBidActivity
          initialBidsPerMinute={pulseData.bidsPerMinute}
          activeLotIds={[...activeLotIds]}
        />
        <p className="mt-2 font-body text-xs text-on-surface-variant">
          {pulseData.activeSaleroomSessions} active session
          {pulseData.activeSaleroomSessions === 1 ? "" : "s"}
        </p>
      </div>

      <div className="py-4">
        <p className="font-body text-sm font-medium text-on-surface">Sale readiness</p>
        {saleReadiness.status !== "ready" ? (
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            {saleReadiness.status === "unavailable"
              ? saleReadiness.message
              : (saleReadiness.message ?? "No upcoming sales to show.")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-shell-stroke">
            {pulseData.rows.map((row) => (
              <li key={row.saleId} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={row.href}
                      className="font-headline text-sm font-medium text-on-surface hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-0.5 font-body text-xs text-on-surface-variant">
                      {saleStatusLabel(row)}
                    </p>
                  </div>
                  {row.consoleHref ? (
                    <Link href={row.consoleHref} className="shrink-0 text-xs text-link">
                      Console
                    </Link>
                  ) : null}
                </div>
                {row.blockers.length > 0 ? (
                  <p className="mt-2 font-body text-xs text-warning-on-surface">
                    {row.blockers.length} blocker{row.blockers.length === 1 ? "" : "s"} ·{" "}
                    {row.blockers
                      .slice(0, 2)
                      .map((b) => (b.count != null ? `${b.label} (${b.count})` : b.label))
                      .join(", ")}
                  </p>
                ) : (
                  <p className="mt-2 font-body text-xs text-on-surface-variant">Ready</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function saleReadinessAttentionSummary(saleReadiness: SaleReadinessSlice): string | null {
  if (saleReadiness.status !== "ready") return null;
  const { rows, activeSaleroomSessions } = saleReadiness.data;
  const blockerCount = rows.reduce((sum, row) => sum + row.blockers.length, 0);
  if (activeSaleroomSessions > 0) {
    return `${activeSaleroomSessions} live session${activeSaleroomSessions === 1 ? "" : "s"}`;
  }
  if (blockerCount > 0) {
    return `${blockerCount} sale blocker${blockerCount === 1 ? "" : "s"}`;
  }
  return null;
}

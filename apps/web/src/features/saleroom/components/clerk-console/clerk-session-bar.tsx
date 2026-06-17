import { ConnectionStatusChip } from "@/features/saleroom/components/shared/connection-status-chip";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import type { StaffSaleroomSessionVM } from "@/features/saleroom/types/staff-saleroom.vm";
import type { LotRunProgress } from "@/lib/saleroom/lot-run-progress";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import { formatMoney } from "@/lib/ui/format";
import type { Lot, SaleDeliveryMode } from "@auction/types";

type Props = {
  saleTitle: string;
  deliveryMode?: SaleDeliveryMode;
  session: StaffSaleroomSessionVM;
  currentLot: Lot | null;
  progress: LotRunProgress;
  leaderLabel?: string | null;
  leaderAmount?: string | null;
  variant?: "full" | "compact";
};

export function ClerkSessionBar({
  saleTitle,
  deliveryMode,
  session,
  currentLot,
  progress,
  leaderLabel,
  leaderAmount,
  variant = "full",
}: Props) {
  const progressPercent =
    progress.totalLots > 0 ? Math.round((progress.completedLots / progress.totalLots) * 100) : 0;
  const showLeadingBid = variant === "full" && leaderLabel;

  return (
    <div className="space-y-4 rounded-lg border border-outline-variant/25 bg-surface-container-low p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {deliveryMode ? <SaleDeliveryModeBadge mode={deliveryMode} /> : null}
        {session.isSessionLive ? (
          <span className="rounded-full bg-error/10 px-2.5 py-1 font-label text-[10px] uppercase tracking-wide text-error">
            Live
          </span>
        ) : session.status === "paused" ? (
          <span className="rounded-full bg-warning/10 px-2.5 py-1 font-label text-[10px] uppercase tracking-wide text-warning">
            Paused
          </span>
        ) : (
          <span className="rounded-full bg-surface-container-high px-2.5 py-1 font-label text-[10px] uppercase tracking-wide text-secondary capitalize">
            {session.status}
          </span>
        )}
        {progress.sessionStatusLabel ? (
          <span className="font-body text-xs text-secondary">{progress.sessionStatusLabel}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-body text-sm text-foreground">
            <span className="font-medium">{saleTitle}</span>
            {currentLot && !progress.betweenLots ? (
              <>
                {" "}
                · <span className="font-medium">{formatLotRunListLabel(currentLot)}</span>
              </>
            ) : null}
          </p>
          <div className="space-y-1" aria-live="polite">
            <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              {progress.progressLabel}
            </p>
            {progress.totalLots > 0 ? (
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 max-w-xs flex-1 rounded-full bg-surface-container-high"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="font-body text-xs tabular-nums text-secondary">
                  {progress.completedLots}/{progress.totalLots}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {showLeadingBid ? (
          <div className="rounded-md border border-outline-variant/20 bg-surface-container-high/50 px-3 py-2 text-right">
            <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Leading bid
            </p>
            <p className="mt-1 font-headline text-xl tabular-nums text-foreground">
              {leaderAmount ? formatMoney(leaderAmount) : "—"}
            </p>
            <p className="font-body text-sm text-secondary">
              <span className="font-medium text-foreground">{leaderLabel}</span>
            </p>
          </div>
        ) : null}
      </div>

      <ConnectionStatusChip status={session.connectionStatus} lastEventAt={session.lastEventAt} />
    </div>
  );
}

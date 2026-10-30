import { ConnectionStatusChip } from "@/features/saleroom/components/shared/connection-status-chip";
import { formatSaleroomMoney } from "@/features/saleroom/lib/format-saleroom-money";
import type { StaffSaleroomSessionVM } from "@/features/saleroom/types/staff-saleroom.vm";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { LotRunProgress } from "@/lib/saleroom/lot-run-progress";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import { ProgressBar, StatusBadge } from "@auction/staff-ui";
import type { Lot } from "@auction/types";

type Props = {
  session: StaffSaleroomSessionVM;
  currentLot: Lot | null;
  progress: LotRunProgress;
  leaderLabel?: string | null;
  leaderAmount?: string | null;
  mode?: "full" | "live";
};

/**
 * The room at a glance, updating as events arrive: whether it is live, how far through the lots
 * it is, who leads, and whether the feed is still reaching this screen. It is the one place the
 * room's status shows, so it can never disagree with the controls under it.
 */
export function ClerkSessionBar({
  session,
  currentLot,
  progress,
  leaderLabel,
  leaderAmount,
  mode = "full",
}: Props) {
  const status = staffStatus("saleroomSession", session.status);
  const showLeadingBid = mode === "full" && Boolean(leaderLabel);

  return (
    <section
      aria-label="Session"
      className="flex flex-col gap-3 rounded-staff-lg border border-staff-line bg-staff-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge tone={status.tone} live={status.live ?? false}>
              {status.label}
            </StatusBadge>
            {currentLot && !progress.betweenLots ? (
              <span className="text-staff-sm font-medium text-staff-fg">
                {formatLotRunListLabel(currentLot)}
              </span>
            ) : null}
          </div>
          <div className="flex max-w-sm flex-col gap-1.5" aria-live="polite">
            <div className="flex items-baseline justify-between gap-3 text-staff-sm">
              <p className="text-staff-fg">{progress.progressLabel}</p>
              {progress.totalLots > 0 ? (
                <p className="text-staff-muted tabular-nums">
                  {progress.completedLots} of {progress.totalLots} complete
                </p>
              ) : null}
            </div>
            {progress.totalLots > 0 ? (
              <ProgressBar
                value={progress.completedLots}
                max={progress.totalLots}
                label="Lots complete"
              />
            ) : null}
          </div>
        </div>

        {showLeadingBid ? (
          <div className="rounded-staff-sm border border-staff-line-subtle bg-staff-sunken px-3 py-2 text-right">
            <p className="text-staff-xs text-staff-muted">Leading bid</p>
            <p className="font-staff-display text-staff-xl font-semibold text-staff-fg tabular-nums">
              {leaderAmount ? formatSaleroomMoney(leaderAmount) : "—"}
            </p>
            <p className="text-staff-sm font-medium text-staff-fg">{leaderLabel}</p>
          </div>
        ) : null}
      </div>

      <ConnectionStatusChip status={session.connectionStatus} lastEventAt={session.lastEventAt} />
    </section>
  );
}

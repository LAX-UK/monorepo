import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { Surface } from "@auction/ui/components/surface";

type Stats = {
  total: number;
  checkedIn: number;
  checkInDryRun: boolean;
};

type Props = {
  title: string;
  stats: Stats;
  statsError: string | null;
  dryRunBusy: boolean;
  dryRunError: string | null;
  dryRunConfirmOpen: boolean;
  onDryRunConfirmOpenChange: (open: boolean) => void;
  onEnableDryRun: () => void;
  onDisableDryRun: () => void;
};

export function CheckInStatsHeader({
  title,
  stats,
  statsError,
  dryRunBusy,
  dryRunError,
  dryRunConfirmOpen,
  onDryRunConfirmOpenChange,
  onEnableDryRun,
  onDisableDryRun,
}: Props) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
            {title}
          </h1>
          <p className="font-body text-sm text-on-surface-variant">
            {stats.checkedIn} / {stats.total} arrived
            {stats.checkInDryRun ? " · Dry-run mode on" : ""}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={stats.checkInDryRun ? "default" : "outline"}
          disabled={dryRunBusy}
          aria-pressed={stats.checkInDryRun}
          aria-describedby="check-in-dry-run-hint"
          onClick={() => {
            if (stats.checkInDryRun) {
              onDryRunConfirmOpenChange(true);
              return;
            }
            onEnableDryRun();
          }}
        >
          {dryRunBusy ? "Updating…" : stats.checkInDryRun ? "Dry-run on" : "Dry-run off"}
        </Button>
      </div>

      <p id="check-in-dry-run-hint" className="sr-only">
        Dry-run mode validates passes without recording arrivals. Turn off when the door opens for
        live check-in.
      </p>

      {stats.checkInDryRun ? (
        <Surface className="border border-amber-500/50 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-950/30">
          <output
            aria-live="polite"
            className="block font-body text-sm font-medium text-amber-950 dark:text-amber-100"
          >
            Dry-run mode is on — scans are validated but not recorded. Turn off before admitting
            guests for real.
          </output>
        </Surface>
      ) : null}

      {statsError ? (
        <AdminListAlert title="Could not refresh arrival stats" variant="default">
          {statsError}
        </AdminListAlert>
      ) : null}

      {dryRunError ? <AdminListAlert>{dryRunError}</AdminListAlert> : null}

      <ConfirmDialog
        open={dryRunConfirmOpen}
        onOpenChange={onDryRunConfirmOpenChange}
        title="Go live with check-in?"
        body={
          <p>
            Turning off dry-run will record real arrivals. Only continue when you are ready to admit
            guests at the door.
          </p>
        }
        confirmLabel="Go live"
        tone="danger"
        loading={dryRunBusy}
        onConfirm={onDisableDryRun}
      />
    </>
  );
}

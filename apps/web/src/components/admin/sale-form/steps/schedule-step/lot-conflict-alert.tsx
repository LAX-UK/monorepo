import type { LotWindowConflict, SaleWindow } from "@/lib/admin/sale-lot-window-sync";
import { scheduleLotConflictBanner } from "@/lib/admin/sale-setup/field-copy";
import { formatDateTime } from "@/lib/ui/format";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";

type Props = {
  lotConflicts: readonly LotWindowConflict[];
  pendingWindow: SaleWindow | null;
  lotsSetupHref?: string;
};

export function LotConflictAlert({ lotConflicts, pendingWindow, lotsSetupHref }: Props) {
  if (lotConflicts.length === 0 || !pendingWindow) return null;

  return (
    <Alert className="border-warning/40 bg-warning/5">
      <AlertDescription className="space-y-2 text-pretty font-body text-sm text-on-surface-variant">
        <p className="font-medium text-on-surface">
          {scheduleLotConflictBanner(lotConflicts.length)}
        </p>
        <p>
          Pending sale window: {formatDateTime(pendingWindow.startTime)} –{" "}
          {formatDateTime(pendingWindow.endTime)} (London time).
        </p>
        {lotsSetupHref ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={lotsSetupHref}>Adjust lot schedules</a>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

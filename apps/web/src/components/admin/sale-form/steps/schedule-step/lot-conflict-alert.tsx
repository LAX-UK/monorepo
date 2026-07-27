import {
  type LotWindowConflict,
  type SaleWindow,
  saleInheritsLotTiming,
} from "@/lib/admin/sale-lot-window-sync";
import {
  scheduleLotConflictBanner,
  scheduleLotConflictInheritedTimingBanner,
} from "@/lib/admin/sale-setup/field-copy";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { formatAuctionDatetimeDisplay } from "@auction/validators";

type Props = {
  lotConflicts: readonly LotWindowConflict[];
  pendingWindow: SaleWindow | null;
  lotsSetupHref?: string;
};

export function LotConflictAlert({ lotConflicts, pendingWindow, lotsSetupHref }: Props) {
  if (lotConflicts.length === 0 || !pendingWindow) return null;

  const inheritsLotTiming = saleInheritsLotTiming(pendingWindow);

  return (
    <Alert
      className={
        inheritsLotTiming
          ? "border-outline-variant/40 bg-surface-container-low/40"
          : "border-warning/40 bg-warning/5"
      }
    >
      <AlertDescription className="space-y-2 text-pretty font-body text-sm text-on-surface-variant">
        <p className="font-medium text-on-surface">
          {inheritsLotTiming
            ? scheduleLotConflictInheritedTimingBanner(lotConflicts.length)
            : scheduleLotConflictBanner(lotConflicts.length)}
        </p>
        <p>
          Pending sale window: {formatAuctionDatetimeDisplay(pendingWindow.startTime)} –{" "}
          {formatAuctionDatetimeDisplay(pendingWindow.endTime)} (London time).
        </p>
        {!inheritsLotTiming && lotsSetupHref ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={lotsSetupHref}>Adjust lot schedules</a>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

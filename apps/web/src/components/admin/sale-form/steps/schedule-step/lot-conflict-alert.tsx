import {
  type LotWindowConflict,
  type SaleWindow,
  saleInheritsLotTiming,
} from "@/lib/admin/sale-lot-window-sync";
import {
  scheduleLotConflictBanner,
  scheduleLotConflictInheritedTimingBanner,
} from "@/lib/admin/sale-setup/field-copy";
import { Notice, StaffButtonLink, formatStaffDateTime } from "@auction/staff-ui";

type Props = {
  lotConflicts: readonly LotWindowConflict[];
  pendingWindow: SaleWindow | null;
  lotsSetupHref?: string;
};

export function LotConflictAlert({ lotConflicts, pendingWindow, lotsSetupHref }: Props) {
  if (lotConflicts.length === 0 || !pendingWindow) return null;

  const inheritsLotTiming = saleInheritsLotTiming(pendingWindow);

  return (
    <Notice
      tone={inheritsLotTiming ? "info" : "warning"}
      title={
        inheritsLotTiming
          ? scheduleLotConflictInheritedTimingBanner(lotConflicts.length)
          : scheduleLotConflictBanner(lotConflicts.length)
      }
      actions={
        !inheritsLotTiming && lotsSetupHref ? (
          <StaffButtonLink size="sm" variant="secondary" href={lotsSetupHref}>
            Adjust lot schedules
          </StaffButtonLink>
        ) : null
      }
    >
      New sale window: {formatStaffDateTime(pendingWindow.startTime, { zoneLabel: true })} to{" "}
      {formatStaffDateTime(pendingWindow.endTime, { zoneLabel: true })}.
    </Notice>
  );
}

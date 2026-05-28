"use client";

import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { toLotTimerInputs } from "@/lib/lot/to-lot-timer-inputs";
import type { LotStatus } from "@auction/types";

type DashboardLotCountdownProps = {
  status: LotStatus;
  startTime: string | Date | null;
  endTime: string | Date | null;
  /** Fallback line when timer state is unknown (e.g. draft). */
  closingShort?: string | null;
};

/** Document-flow lot countdown for dashboard tables and list cards. */
export function DashboardLotCountdown({
  closingShort,
  status,
  startTime,
  endTime,
}: DashboardLotCountdownProps) {
  const closingShortProp = closingShort !== undefined ? { closingShort } : {};

  return (
    <LotStatusBadge {...closingShortProp} {...toLotTimerInputs({ status, startTime, endTime })} />
  );
}

"use client";

import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import type { LotStatus } from "@auction/types";

type DashboardLotCountdownProps = {
  status: LotStatus;
  startTime: string | Date | null;
  endTime: string | Date | null;
  /** API winner — drives Sold vs Unsold when status is `ended`. */
  winnerId?: string | null | undefined;
};

/** Document-flow lot countdown for dashboard tables and list cards. */
export function DashboardLotCountdown({
  winnerId,
  status,
  startTime,
  endTime,
}: DashboardLotCountdownProps) {
  return (
    <LotStatusBadge
      {...lotStatusBadgeProps({
        status,
        startTime,
        endTime,
        ...(winnerId !== undefined ? { winnerId } : {}),
      })}
    />
  );
}

"use client";

import { useStaffSaleroomLive } from "@/features/saleroom/hooks/use-staff-saleroom-live";
import type { AdminSaleroomEventRow } from "@/lib/data/http/admin.server";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { ReactNode } from "react";

type Props = {
  saleId: string;
  initial: PublicSaleroomSessionStatus;
  dbEvents?: AdminSaleroomEventRow[];
  trackLiveFeed?: boolean;
  children: (value: ReturnType<typeof useStaffSaleroomLive>) => ReactNode;
};

/** Client island wrapper — pages pass server-fetched initial state. */
export function SaleroomLiveShell({
  saleId,
  initial,
  dbEvents = [],
  trackLiveFeed = true,
  children,
}: Props) {
  const live = useStaffSaleroomLive({
    saleId,
    initial,
    trackLiveFeed,
    dbEvents,
  });
  return <>{children(live)}</>;
}

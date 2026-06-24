"use client";

import { LiveConnectivityNoticeBanner } from "@/components/realtime/live-connectivity-notice-banner";
import { useStaffSaleroomLive } from "@/features/saleroom/hooks/use-staff-saleroom-live";
import { LiveConnectivityNoticeProvider } from "@/lib/connection/live-connectivity-notice";
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

function SaleroomLiveShellInner({
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
  return (
    <>
      <LiveConnectivityNoticeBanner
        scope="saleroom"
        testId="staff-saleroom-connectivity-notice-banner"
      />
      {children(live)}
    </>
  );
}

/** Client island wrapper — pages pass server-fetched initial state. */
export function SaleroomLiveShell(props: Props) {
  return (
    <LiveConnectivityNoticeProvider>
      <SaleroomLiveShellInner {...props} />
    </LiveConnectivityNoticeProvider>
  );
}

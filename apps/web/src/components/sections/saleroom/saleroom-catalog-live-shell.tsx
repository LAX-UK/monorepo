"use client";

import { MarketingLiveConnectivityBanner } from "@/components/realtime/marketing-live-connectivity-banner";
import { LiveConnectivityNoticeProvider } from "@/lib/connection/live-connectivity-notice";
import { RealtimeHealthProvider } from "@/lib/connection/realtime-health-provider";
import { MaybeSaleroomLiveProvider } from "@/lib/context/saleroom-live-provider";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { ReactNode } from "react";

type Props = {
  saleId: string | null;
  initial: PublicSaleroomSessionStatus;
  children: ReactNode;
};

/** Wraps saleroom sale catalog with live session subscription when saleId is set. */
export function SaleroomCatalogLiveShell({ saleId, initial, children }: Props) {
  return (
    <RealtimeHealthProvider>
      <LiveConnectivityNoticeProvider>
        <MaybeSaleroomLiveProvider saleId={saleId} initial={initial}>
          <MarketingLiveConnectivityBanner enabled={saleId != null} />
          {children}
        </MaybeSaleroomLiveProvider>
      </LiveConnectivityNoticeProvider>
    </RealtimeHealthProvider>
  );
}

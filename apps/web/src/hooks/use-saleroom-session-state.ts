"use client";

import { useStaffSaleroomLive } from "@/features/saleroom/hooks/use-staff-saleroom-live";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleroomRealtimePayload } from "@auction/types";

type Options = {
  saleId: string;
  initial: PublicSaleroomSessionStatus;
  trackLiveFeed?: boolean;
  liveFeedLimit?: number;
};

/** @deprecated Prefer useStaffSaleroomLive from features/saleroom. */
export function useSaleroomSessionState({
  saleId,
  initial,
  trackLiveFeed = false,
  liveFeedLimit = 40,
}: Options): {
  session: PublicSaleroomSessionStatus;
  liveFeed: SaleroomRealtimePayload[];
} {
  const { session, liveFeed } = useStaffSaleroomLive({
    saleId,
    initial,
    trackLiveFeed,
    liveFeedLimit,
    notifyOnReconnect: false,
  });
  return {
    session: {
      status: session.status,
      currentLotId: session.currentLotId,
    },
    liveFeed,
  };
}

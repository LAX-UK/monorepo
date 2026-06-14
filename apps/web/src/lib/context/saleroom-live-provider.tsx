"use client";

import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { isSaleroomSessionActive } from "@/lib/saleroom/public-session-status";
import { getSocket } from "@/lib/socket";
import type { SaleroomRealtimePayload } from "@auction/types";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SaleroomLiveContextValue = PublicSaleroomSessionStatus & {
  isSessionActive: boolean;
  isLotOnBlock: (lotId: string) => boolean;
};

const SaleroomLiveContext = createContext<SaleroomLiveContextValue | null>(null);

type Props = {
  saleId: string;
  initial: PublicSaleroomSessionStatus;
  children: ReactNode;
};

/** Subscribes to saleroom session events for hybrid/onsite buyer awareness. */
export function SaleroomLiveProvider({ saleId, initial, children }: Props) {
  const [state, setState] = useState<PublicSaleroomSessionStatus>(initial);

  useEffect(() => {
    setState(initial);
  }, [initial]);

  useEffect(() => {
    const socket = getSocket();
    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || typeof event.kind !== "string" || event.saleId !== saleId) return;
      setState((prev) => applySaleroomEvent(prev, event));
    };

    const join = () => {
      socket.emit("joinSaleroom", { saleId }, () => {});
    };

    join();
    socket.on("saleroomEvent", onSaleroom);
    socket.on("connect", join);

    return () => {
      socket.off("saleroomEvent", onSaleroom);
      socket.off("connect", join);
      socket.emit("leaveSaleroom", { saleId }, () => {});
    };
  }, [saleId]);

  const isLotOnBlock = useCallback(
    (lotId: string) => state.currentLotId === lotId && isSaleroomSessionActive(state.status),
    [state.currentLotId, state.status],
  );

  const value = useMemo(
    (): SaleroomLiveContextValue => ({
      ...state,
      isSessionActive: isSaleroomSessionActive(state.status),
      isLotOnBlock,
    }),
    [state, isLotOnBlock],
  );

  return <SaleroomLiveContext.Provider value={value}>{children}</SaleroomLiveContext.Provider>;
}

export function useSaleroomLive(): SaleroomLiveContextValue | null {
  return useContext(SaleroomLiveContext);
}

/** Wraps children in a live saleroom subscription only when `saleId` is set
 * (i.e. hybrid sales). Otherwise renders children unchanged, so callers avoid
 * duplicating subtrees for the hybrid vs non-hybrid branch.
 */
export function MaybeSaleroomLiveProvider({
  saleId,
  initial,
  children,
}: {
  saleId: string | null;
  initial: PublicSaleroomSessionStatus;
  children: ReactNode;
}) {
  if (!saleId) return <>{children}</>;
  return (
    <SaleroomLiveProvider saleId={saleId} initial={initial}>
      {children}
    </SaleroomLiveProvider>
  );
}

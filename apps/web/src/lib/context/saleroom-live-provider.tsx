"use client";

import { fetchSaleroomStatus } from "@/lib/data/http/saleroom-status.client";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import {
  isSaleroomSessionActive,
  isSaleroomSessionLive,
} from "@/lib/saleroom/public-session-status";
import { getSocket } from "@/lib/socket";
import { notify } from "@/lib/ui/notify";
import type { SaleroomRealtimePayload } from "@auction/types";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SaleroomLiveContextValue = PublicSaleroomSessionStatus & {
  isSessionActive: boolean;
  isSessionLive: boolean;
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
  /** After first socket event or HTTP hydrate, ignore SSR `initial` re-seeds. */
  const hasAuthoritativeStateRef = useRef(false);

  useEffect(() => {
    if (!hasAuthoritativeStateRef.current) {
      setState(initial);
    }
  }, [initial]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-subscribe when sale changes; `initial` is applied once per saleId transition
  useEffect(() => {
    hasAuthoritativeStateRef.current = false;
    setState(initial);

    const socket = getSocket();
    let hadConnected = socket.connected;

    const markAuthoritative = () => {
      hasAuthoritativeStateRef.current = true;
    };

    const hydrateFromServer = async (opts?: { notifyOnSuccess?: boolean }): Promise<boolean> => {
      const snap = await fetchSaleroomStatus(saleId);
      if (!snap) {
        notify.warning("Could not refresh saleroom status", {
          id: `saleroom-hydrate-failed-${saleId}`,
          description: "On-block lot info may be stale until the connection recovers.",
          duration: 7000,
        });
        return false;
      }
      setState(snap);
      markAuthoritative();
      if (opts?.notifyOnSuccess) {
        notify.success("Reconnected — saleroom status refreshed", {
          id: `saleroom-reconnect-${saleId}`,
          duration: 5000,
        });
      }
      return true;
    };

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || typeof event.kind !== "string" || event.saleId !== saleId) return;
      setState((prev) => applySaleroomEvent(prev, event));
      markAuthoritative();
    };

    const join = () => {
      socket.emit("joinSaleroom", { saleId }, () => {});
    };

    const onConnect = () => {
      join();
      if (hadConnected) {
        void hydrateFromServer({ notifyOnSuccess: true });
      }
      hadConnected = true;
    };

    join();
    void hydrateFromServer();
    socket.on("saleroomEvent", onSaleroom);
    socket.on("connect", onConnect);

    return () => {
      socket.off("saleroomEvent", onSaleroom);
      socket.off("connect", onConnect);
      socket.emit("leaveSaleroom", { saleId }, () => {});
    };
  }, [saleId]);

  const isLotOnBlock = useCallback(
    (lotId: string) => state.status === "live" && state.currentLotId === lotId,
    [state.currentLotId, state.status],
  );

  const value = useMemo(
    (): SaleroomLiveContextValue => ({
      ...state,
      isSessionActive: isSaleroomSessionActive(state.status),
      isSessionLive: isSaleroomSessionLive(state.status),
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

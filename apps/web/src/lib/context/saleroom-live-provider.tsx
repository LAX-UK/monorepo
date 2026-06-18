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

/** How often to silently re-sync saleroom status while the tab is mounted. */
const RESYNC_INTERVAL_MS = 15_000;

type SaleroomLiveContextValue = PublicSaleroomSessionStatus & {
  isSessionActive: boolean;
  isSessionLive: boolean;
  isLotOnBlock: (lotId: string) => boolean;
  /** Imperatively request a re-hydrate from the server (silent, no toast). */
  refresh: () => void;
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
  /** Prevents overlapping silent hydrates from stacking. */
  const hydratingSilentlyRef = useRef(false);

  useEffect(() => {
    if (!hasAuthoritativeStateRef.current) {
      setState(initial);
    }
  }, [initial]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-subscribe when sale changes; `initial` is applied once per saleId transition
  useEffect(() => {
    hasAuthoritativeStateRef.current = false;
    hydratingSilentlyRef.current = false;
    setState(initial);

    const socket = getSocket();
    let hadConnected = socket.connected;

    const markAuthoritative = () => {
      hasAuthoritativeStateRef.current = true;
    };

    /**
     * Fetch the current saleroom status from the server and apply it.
     * When `silent` is true, failures are swallowed and no toasts are shown,
     * which is appropriate for the periodic interval and focus-resync paths.
     */
    const hydrateFromServer = async (opts?: {
      notifyOnSuccess?: boolean;
      silent?: boolean;
    }): Promise<boolean> => {
      const snap = await fetchSaleroomStatus(saleId);
      if (!snap) {
        if (!opts?.silent) {
          notify.warning("Could not refresh saleroom status", {
            id: `saleroom-hydrate-failed-${saleId}`,
            description: "On-block lot info may be stale until the connection recovers.",
            duration: 7000,
          });
        }
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

    /**
     * Silent re-hydrate used by the interval and visibility paths.
     * De-duped by `hydratingSilentlyRef` so simultaneous triggers only fire once.
     */
    const silentHydrate = () => {
      if (hydratingSilentlyRef.current) return;
      hydratingSilentlyRef.current = true;
      void hydrateFromServer({ silent: true }).finally(() => {
        hydratingSilentlyRef.current = false;
      });
    };

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || typeof event.kind !== "string" || event.saleId !== saleId) return;
      setState((prev) => applySaleroomEvent(prev, event));
      markAuthoritative();
    };

    /**
     * Join the saleroom socket room, then re-hydrate once the server confirms
     * the join. This closes the join/advance race where `advanced_to_lot` fires
     * between the initial hydrate fetch and the room-join completing.
     */
    const join = () => {
      socket.emit("joinSaleroom", { saleId }, () => {
        silentHydrate();
      });
    };

    const onConnect = () => {
      join();
      if (hadConnected) {
        void hydrateFromServer({ notifyOnSuccess: true });
      }
      hadConnected = true;
    };

    /** Re-hydrate when the tab becomes visible (returning user is immediately correct). */
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        silentHydrate();
      }
    };

    join();
    void hydrateFromServer();
    socket.on("saleroomEvent", onSaleroom);
    socket.on("connect", onConnect);
    document.addEventListener("visibilitychange", onVisibilityChange);

    /** Periodic resync: catches any missed saleroom event while the socket stays connected. */
    const intervalId = setInterval(silentHydrate, RESYNC_INTERVAL_MS);

    return () => {
      socket.off("saleroomEvent", onSaleroom);
      socket.off("connect", onConnect);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(intervalId);
      socket.emit("leaveSaleroom", { saleId }, () => {});
    };
  }, [saleId]);

  const isLotOnBlock = useCallback(
    (lotId: string) => state.status === "live" && state.currentLotId === lotId,
    [state.currentLotId, state.status],
  );

  const refresh = useCallback(() => {
    if (hydratingSilentlyRef.current) return;
    hydratingSilentlyRef.current = true;
    void fetchSaleroomStatus(saleId)
      .then((snap) => {
        if (snap) {
          setState(snap);
          hasAuthoritativeStateRef.current = true;
        }
      })
      .finally(() => {
        hydratingSilentlyRef.current = false;
      });
  }, [saleId]);

  const value = useMemo(
    (): SaleroomLiveContextValue => ({
      ...state,
      isSessionActive: isSaleroomSessionActive(state.status),
      isSessionLive: isSaleroomSessionLive(state.status),
      isLotOnBlock,
      refresh,
    }),
    [state, isLotOnBlock, refresh],
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

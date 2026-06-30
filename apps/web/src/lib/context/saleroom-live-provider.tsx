"use client";

import { useSaleroomStatusQuery } from "@/hooks/saleroom/use-saleroom-status-query";
import {
  LIVE_CONNECTIVITY_COPY,
  saleroomHydrateNoticeId,
} from "@/lib/connection/live-connectivity-copy";
import { useLiveConnectivityNoticeReporterOptional } from "@/lib/connection/live-connectivity-notice";
import { saleroomKeys } from "@/lib/data/queries/saleroom";
import { useQueryCacheState } from "@/lib/query/use-query-cache-state";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import {
  isSaleroomSessionActive,
  isSaleroomSessionLive,
} from "@/lib/saleroom/public-session-status";
import { getSocket } from "@/lib/socket";
import type { SaleroomRealtimePayload } from "@auction/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

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

/**
 * Subscribe to saleroom cache updates for socket-driven patches.
 * useQuery().data does not re-render after setQueryData when initialData is set
 * (see use-saleroom-status-query.cache-update.test.tsx).
 */
function useSaleroomCacheState(
  saleId: string,
  initial: PublicSaleroomSessionStatus,
): PublicSaleroomSessionStatus {
  return useQueryCacheState(saleroomKeys.status(saleId), initial, {
    matchUpdatedKey: (updatedKey) =>
      updatedKey[0] === saleroomKeys.all[0] && updatedKey[2] === saleId,
  });
}

/** Subscribes to saleroom session events for hybrid/onsite buyer awareness. */
export function SaleroomLiveProvider({ saleId, initial, children }: Props) {
  const queryClient = useQueryClient();
  const noticeReporter = useLiveConnectivityNoticeReporterOptional();
  const noticeReporterRef = useRef(noticeReporter);
  /** Prevents overlapping silent hydrates from stacking. */
  const hydratingSilentlyRef = useRef(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  const { refetch, isFetching } = useSaleroomStatusQuery(saleId, {
    initialData: initial,
  });

  const state = useSaleroomCacheState(saleId, initial);

  useEffect(() => {
    noticeReporterRef.current = noticeReporter;
  }, [noticeReporter]);

  const hydrateFromServer = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      const noticeId = saleroomHydrateNoticeId(saleId);
      const result = await refetch();
      const snap = result.data ?? null;
      if (!snap) {
        if (!opts?.silent) {
          noticeReporterRef.current?.reportNotice({
            id: noticeId,
            message: LIVE_CONNECTIVITY_COPY.saleroomHydrateFailed,
          });
        }
        return false;
      }
      noticeReporterRef.current?.clearNotice(noticeId);
      return true;
    },
    [saleId, refetch],
  );

  const silentHydrate = useCallback(() => {
    if (hydratingSilentlyRef.current || isFetching) return;
    hydratingSilentlyRef.current = true;
    void hydrateFromServer({ silent: true }).finally(() => {
      hydratingSilentlyRef.current = false;
    });
  }, [hydrateFromServer, isFetching]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-subscribe when sale changes
  useEffect(() => {
    hydratingSilentlyRef.current = false;

    const socket = getSocket();
    let hadConnected = socket.connected;
    const queryKey = saleroomKeys.status(saleId);

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || typeof event.kind !== "string" || event.saleId !== saleId) return;
      queryClient.setQueryData<PublicSaleroomSessionStatus>(queryKey, (prev) =>
        applySaleroomEvent(prev ?? initialRef.current, event),
      );
    };

    const join = () => {
      socket.emit("joinSaleroom", { saleId }, () => {
        silentHydrate();
      });
    };

    const onConnect = () => {
      join();
      if (hadConnected) {
        void hydrateFromServer();
      }
      hadConnected = true;
    };

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

    return () => {
      socket.off("saleroomEvent", onSaleroom);
      socket.off("connect", onConnect);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      socket.emit("leaveSaleroom", { saleId }, () => {});
    };
  }, [saleId]);

  const isLotOnBlock = useCallback(
    (lotId: string) => state.status === "live" && state.currentLotId === lotId,
    [state.currentLotId, state.status],
  );

  const refresh = useCallback(() => {
    silentHydrate();
  }, [silentHydrate]);

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

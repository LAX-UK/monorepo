"use client";

import {
  type SaleroomSocketAdapter,
  createSaleroomSocketAdapter,
} from "@/features/saleroom/adapters/saleroom-socket.adapter";
import { fetchSaleroomStatus } from "@/lib/data/http/saleroom-status.client";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleroomRealtimePayload } from "@auction/types";
import { useEffect, useMemo, useRef, useState } from "react";

export type SaleroomHubLiveSession = PublicSaleroomSessionStatus & {
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  lastEventAt: string | null;
};

type Options = {
  saleIds: string[];
  initialBySaleId: Record<string, PublicSaleroomSessionStatus>;
  socketAdapter?: SaleroomSocketAdapter;
};

export type SaleroomHubLiveState = {
  sessions: Record<string, SaleroomHubLiveSession>;
  completedBumps: Record<string, number>;
};

const DEFAULT_SESSION: PublicSaleroomSessionStatus = { status: "none", currentLotId: null };

function stableSaleIdsKey(saleIds: readonly string[]): string {
  return saleIds.join("\0");
}

function stableInitialSessionsKey(
  saleIds: readonly string[],
  initialBySaleId: Record<string, PublicSaleroomSessionStatus>,
): string {
  return saleIds
    .map((id) => {
      const s = initialBySaleId[id] ?? DEFAULT_SESSION;
      return `${id}:${s.status}:${s.currentLotId ?? ""}`;
    })
    .join("|");
}

export function useSaleroomHubLive({
  saleIds,
  initialBySaleId,
  socketAdapter = createSaleroomSocketAdapter(),
}: Options): SaleroomHubLiveState {
  const [sessions, setSessions] = useState<Record<string, SaleroomHubLiveSession>>(() =>
    buildInitialSessions(saleIds, initialBySaleId),
  );
  const [completedBumps, setCompletedBumps] = useState<Record<string, number>>({});

  const saleIdsRef = useRef(saleIds);
  const initialBySaleIdRef = useRef(initialBySaleId);
  saleIdsRef.current = saleIds;
  initialBySaleIdRef.current = initialBySaleId;

  const saleIdsKey = stableSaleIdsKey(saleIds);
  const initialSessionsKey = stableInitialSessionsKey(saleIds, initialBySaleId);

  // Stable keys re-run when sale ids or initial session props change without array/object reference churn.
  // biome-ignore lint/correctness/useExhaustiveDependencies: saleIdsKey and initialSessionsKey are deliberate effect triggers
  useEffect(() => {
    setSessions(buildInitialSessions(saleIdsRef.current, initialBySaleIdRef.current));
    setCompletedBumps({});
  }, [saleIdsKey, initialSessionsKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: saleIdsKey retriggers socket subscription when the sale list changes
  useEffect(() => {
    const activeSaleIds = saleIdsRef.current;
    if (activeSaleIds.length === 0) return;

    let hadConnected = socketAdapter.isConnected();

    const hydrateAll = async () => {
      const results = await Promise.all(
        activeSaleIds.map(async (saleId) => {
          const snap = await fetchSaleroomStatus(saleId);
          return { saleId, snap };
        }),
      );
      setSessions((prev) => {
        const next = { ...prev };
        for (const { saleId, snap } of results) {
          if (!snap) {
            next[saleId] = {
              ...DEFAULT_SESSION,
              connectionStatus: "disconnected",
              lastEventAt: prev[saleId]?.lastEventAt ?? null,
            };
          } else {
            next[saleId] = {
              ...snap,
              connectionStatus: "connected",
              lastEventAt: new Date().toISOString(),
            };
          }
        }
        return next;
      });
    };

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event?.saleId || !activeSaleIds.includes(event.saleId)) return;
      if (event.kind === "hammer" || event.kind === "no_sale") {
        setCompletedBumps((prev) => ({
          ...prev,
          [event.saleId]: (prev[event.saleId] ?? 0) + 1,
        }));
      }
      setSessions((prev) => {
        const current = prev[event.saleId] ?? {
          ...DEFAULT_SESSION,
          connectionStatus: "connected",
          lastEventAt: null,
        };
        return {
          ...prev,
          [event.saleId]: {
            ...applySaleroomEvent(current, event),
            connectionStatus: "connected",
            lastEventAt: event.emittedAt ?? new Date().toISOString(),
          },
        };
      });
    };

    const joinAll = () => {
      for (const saleId of activeSaleIds) {
        socketAdapter.joinSaleroom(saleId);
      }
    };

    const onConnect = () => {
      joinAll();
      if (hadConnected) {
        setSessions((prev) => {
          const next = { ...prev };
          for (const saleId of activeSaleIds) {
            next[saleId] = {
              ...(next[saleId] ?? { ...DEFAULT_SESSION, lastEventAt: null }),
              connectionStatus: "reconnecting",
            };
          }
          return next;
        });
        void hydrateAll();
      } else {
        setSessions((prev) => {
          const next = { ...prev };
          for (const saleId of activeSaleIds) {
            next[saleId] = {
              ...(next[saleId] ?? { ...DEFAULT_SESSION, lastEventAt: null }),
              connectionStatus: socketAdapter.isConnected() ? "connected" : "reconnecting",
            };
          }
          return next;
        });
      }
      hadConnected = true;
    };

    const onDisconnect = () => {
      setSessions((prev) => {
        const next = { ...prev };
        for (const saleId of activeSaleIds) {
          next[saleId] = {
            ...(next[saleId] ?? { ...DEFAULT_SESSION, lastEventAt: null }),
            connectionStatus: "disconnected",
          };
        }
        return next;
      });
    };

    joinAll();
    socketAdapter.onSaleroomEvent(onSaleroom);
    socketAdapter.onConnect(onConnect);
    socketAdapter.onDisconnect(onDisconnect);

    return () => {
      socketAdapter.offSaleroomEvent(onSaleroom);
      socketAdapter.offConnect(onConnect);
      socketAdapter.offDisconnect(onDisconnect);
      for (const saleId of activeSaleIds) {
        socketAdapter.leaveSaleroom(saleId);
      }
    };
  }, [saleIdsKey, socketAdapter]);

  return useMemo(() => ({ sessions, completedBumps }), [sessions, completedBumps]);
}

function buildInitialSessions(
  saleIds: string[],
  initialBySaleId: Record<string, PublicSaleroomSessionStatus>,
): Record<string, SaleroomHubLiveSession> {
  const out: Record<string, SaleroomHubLiveSession> = {};
  for (const saleId of saleIds) {
    const initial = initialBySaleId[saleId] ?? DEFAULT_SESSION;
    out[saleId] = {
      ...initial,
      connectionStatus: "connected",
      lastEventAt: null,
    };
  }
  return out;
}

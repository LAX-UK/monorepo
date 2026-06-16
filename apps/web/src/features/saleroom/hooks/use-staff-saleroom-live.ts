"use client";

import {
  type SaleroomSocketAdapter,
  createSaleroomSocketAdapter,
} from "@/features/saleroom/adapters/saleroom-socket.adapter";
import { mergeActivityLog } from "@/features/saleroom/lib/format-saleroom-activity";
import type {
  SaleroomActivityEntry,
  StaffSaleroomSessionVM,
} from "@/features/saleroom/types/staff-saleroom.vm";
import type { AdminSaleroomEventRow } from "@/lib/data/http/admin.server";
import { fetchSaleroomStatus } from "@/lib/data/http/saleroom-status.client";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import {
  isSaleroomSessionActive,
  isSaleroomSessionLive,
} from "@/lib/saleroom/public-session-status";
import { notify } from "@/lib/ui/notify";
import type { SaleroomRealtimePayload } from "@auction/types";
import { useEffect, useMemo, useRef, useState } from "react";

type Options = {
  saleId: string;
  initial: PublicSaleroomSessionStatus;
  trackLiveFeed?: boolean;
  liveFeedLimit?: number;
  dbEvents?: AdminSaleroomEventRow[];
  socketAdapter?: SaleroomSocketAdapter;
  notifyOnReconnect?: boolean;
};

function toStaffSessionVM(
  session: PublicSaleroomSessionStatus,
  connectionStatus: StaffSaleroomSessionVM["connectionStatus"],
  lastEventAt: string | null,
): StaffSaleroomSessionVM {
  return {
    ...session,
    isSessionActive: isSaleroomSessionActive(session.status),
    isSessionLive: isSaleroomSessionLive(session.status),
    connectionStatus,
    lastEventAt,
  };
}

export function useStaffSaleroomLive({
  saleId,
  initial,
  trackLiveFeed = false,
  liveFeedLimit = 40,
  dbEvents = [],
  socketAdapter = createSaleroomSocketAdapter(),
  notifyOnReconnect = true,
}: Options): {
  session: StaffSaleroomSessionVM;
  liveFeed: SaleroomRealtimePayload[];
  activityLog: SaleroomActivityEntry[];
} {
  const [session, setSession] = useState<PublicSaleroomSessionStatus>(initial);
  const [liveFeed, setLiveFeed] = useState<SaleroomRealtimePayload[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<StaffSaleroomSessionVM["connectionStatus"]>("connected");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const connectionStatusRef = useRef(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  useEffect(() => {
    if (connectionStatusRef.current === "disconnected") {
      setSession(initial);
    }
  }, [initial]);

  useEffect(() => {
    let hadConnected = socketAdapter.isConnected();

    const hydrateFromServer = async (): Promise<boolean> => {
      const snap = await fetchSaleroomStatus(saleId);
      if (!snap) {
        setConnectionStatus("disconnected");
        if (notifyOnReconnect) {
          notify.warning("Could not refresh saleroom status", {
            id: `saleroom-hydrate-failed-${saleId}`,
            description: "Session info may be stale until the connection recovers.",
            duration: 7000,
          });
        }
        return false;
      }
      setSession(snap);
      setConnectionStatus("connected");
      setLastEventAt(new Date().toISOString());
      return true;
    };

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || typeof event.kind !== "string" || event.saleId !== saleId) return;
      setSession((prev) => applySaleroomEvent(prev, event));
      setLastEventAt(event.emittedAt ?? new Date().toISOString());
      setConnectionStatus("connected");
      if (trackLiveFeed) {
        setLiveFeed((prev) => [event, ...prev].slice(0, liveFeedLimit));
      }
    };

    const join = () => {
      socketAdapter.joinSaleroom(saleId);
    };

    const onConnect = () => {
      join();
      if (hadConnected) {
        setConnectionStatus("reconnecting");
        void hydrateFromServer().then((ok) => {
          if (ok && notifyOnReconnect) {
            notify.success("Reconnected — saleroom status refreshed", {
              id: `saleroom-reconnect-${saleId}`,
              duration: 5000,
            });
          }
        });
      } else {
        setConnectionStatus(socketAdapter.isConnected() ? "connected" : "reconnecting");
      }
      hadConnected = true;
    };

    const onDisconnect = () => {
      setConnectionStatus("disconnected");
    };

    join();
    socketAdapter.onSaleroomEvent(onSaleroom);
    socketAdapter.onConnect(onConnect);
    socketAdapter.onDisconnect(onDisconnect);

    return () => {
      socketAdapter.offSaleroomEvent(onSaleroom);
      socketAdapter.offConnect(onConnect);
      socketAdapter.offDisconnect(onDisconnect);
      socketAdapter.leaveSaleroom(saleId);
    };
  }, [liveFeedLimit, notifyOnReconnect, saleId, socketAdapter, trackLiveFeed]);

  const staffSession = useMemo(
    () => toStaffSessionVM(session, connectionStatus, lastEventAt),
    [connectionStatus, lastEventAt, session],
  );

  const activityLog = useMemo(
    () => mergeActivityLog(liveFeed, dbEvents, liveFeedLimit),
    [dbEvents, liveFeed, liveFeedLimit],
  );

  return { session: staffSession, liveFeed, activityLog };
}

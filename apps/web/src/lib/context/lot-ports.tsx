"use client";

import { useRealtimeHealthPortOptional } from "@/lib/connection/realtime-health-provider";
import type { AbsenteeBidWriter, BidWriter } from "@/lib/data/contracts";
import { createHttpAbsenteeBidWriter } from "@/lib/data/http/absentee-bid";
import { createHttpBidWriter } from "@/lib/data/http/bids";
import type { LotRealtimePort, RealtimeHealthPort } from "@/lib/realtime/contracts";
import { createSocketLotRealtime } from "@/lib/realtime/socket-adapter";
import { createSocketHealthAdapter } from "@/lib/realtime/socket-health-adapter";
import { type ReactNode, createContext, useContext, useMemo } from "react";

export type LotPortsValue = {
  bidWriter: BidWriter;
  absenteeBidWriter: AbsenteeBidWriter;
  realtime: LotRealtimePort;
  health: RealtimeHealthPort;
};

const LotPortsContext = createContext<LotPortsValue | null>(null);

export function LotPortsProvider({
  children,
  bidWriter,
  absenteeBidWriter,
  realtime,
  health,
  actingEntityId,
}: {
  children: ReactNode;
  bidWriter?: BidWriter;
  absenteeBidWriter?: AbsenteeBidWriter;
  realtime?: LotRealtimePort;
  health?: RealtimeHealthPort;
  /** Server-resolved acting entity, forwarded to bid writers as an explicit
   * `X-Legal-Entity-Id` header so bids never trust a stale browser cookie. */
  actingEntityId?: string | undefined;
}) {
  const contextHealth = useRealtimeHealthPortOptional();
  const value = useMemo<LotPortsValue>(
    () => ({
      bidWriter: bidWriter ?? createHttpBidWriter(actingEntityId),
      absenteeBidWriter: absenteeBidWriter ?? createHttpAbsenteeBidWriter(actingEntityId),
      realtime: realtime ?? createSocketLotRealtime(),
      health: health ?? contextHealth ?? createSocketHealthAdapter(),
    }),
    [bidWriter, absenteeBidWriter, realtime, health, contextHealth, actingEntityId],
  );
  return <LotPortsContext.Provider value={value}>{children}</LotPortsContext.Provider>;
}

export function useLotPorts(): LotPortsValue {
  const ctx = useContext(LotPortsContext);
  if (!ctx) {
    throw new Error("useLotPorts must be used within LotPortsProvider");
  }
  return ctx;
}

export function useLotPortsOptional(): LotPortsValue | null {
  return useContext(LotPortsContext);
}

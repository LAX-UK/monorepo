"use client";

import type { AutoBidWriter, BidWriter } from "@/lib/data/contracts";
import { createHttpAutoBidWriter } from "@/lib/data/http/auto-bid";
import { createHttpBidWriter } from "@/lib/data/http/bids";
import type { LotRealtimePort, RealtimeHealthPort } from "@/lib/realtime/contracts";
import { createSocketLotRealtime } from "@/lib/realtime/socket-adapter";
import { createSocketHealthAdapter } from "@/lib/realtime/socket-health-adapter";
import { type ReactNode, createContext, useContext, useMemo } from "react";

export type LotPortsValue = {
  bidWriter: BidWriter;
  autoBidWriter: AutoBidWriter;
  realtime: LotRealtimePort;
  health: RealtimeHealthPort;
};

const LotPortsContext = createContext<LotPortsValue | null>(null);

export function LotPortsProvider({
  children,
  bidWriter,
  autoBidWriter,
  realtime,
  health,
}: {
  children: ReactNode;
  bidWriter?: BidWriter;
  autoBidWriter?: AutoBidWriter;
  realtime?: LotRealtimePort;
  health?: RealtimeHealthPort;
}) {
  const value = useMemo<LotPortsValue>(
    () => ({
      bidWriter: bidWriter ?? createHttpBidWriter(),
      autoBidWriter: autoBidWriter ?? createHttpAutoBidWriter(),
      realtime: realtime ?? createSocketLotRealtime(),
      health: health ?? createSocketHealthAdapter(),
    }),
    [bidWriter, autoBidWriter, realtime, health],
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

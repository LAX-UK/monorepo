"use client";

import type { BidWriter } from "@/lib/data/contracts";
import { createHttpBidWriter } from "@/lib/data/http/bids";
import type { LotRealtimePort } from "@/lib/realtime/contracts";
import { createSocketLotRealtime } from "@/lib/realtime/socket-adapter";
import { type ReactNode, createContext, useContext, useMemo } from "react";

export type LotPortsValue = {
  bidWriter: BidWriter;
  realtime: LotRealtimePort;
};

const LotPortsContext = createContext<LotPortsValue | null>(null);

export function LotPortsProvider({
  children,
  bidWriter,
  realtime,
}: {
  children: ReactNode;
  bidWriter?: BidWriter;
  realtime?: LotRealtimePort;
}) {
  const value = useMemo<LotPortsValue>(
    () => ({
      bidWriter: bidWriter ?? createHttpBidWriter(),
      realtime: realtime ?? createSocketLotRealtime(),
    }),
    [bidWriter, realtime],
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

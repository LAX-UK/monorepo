"use client";

import type { BidWriter } from "@/lib/data/contracts";
import { createHttpBidWriter } from "@/lib/data/http/bids";
import type { AuctionRealtimePort } from "@/lib/realtime/contracts";
import { createSocketAuctionRealtime } from "@/lib/realtime/socket-adapter";
import { type ReactNode, createContext, useContext, useMemo } from "react";

export type AuctionPortsValue = {
  bidWriter: BidWriter;
  realtime: AuctionRealtimePort;
};

const AuctionPortsContext = createContext<AuctionPortsValue | null>(null);

export function AuctionPortsProvider({
  children,
  bidWriter,
  realtime,
}: {
  children: ReactNode;
  bidWriter?: BidWriter;
  realtime?: AuctionRealtimePort;
}) {
  const value = useMemo<AuctionPortsValue>(
    () => ({
      bidWriter: bidWriter ?? createHttpBidWriter(),
      realtime: realtime ?? createSocketAuctionRealtime(),
    }),
    [bidWriter, realtime],
  );
  return <AuctionPortsContext.Provider value={value}>{children}</AuctionPortsContext.Provider>;
}

export function useAuctionPorts(): AuctionPortsValue {
  const ctx = useContext(AuctionPortsContext);
  if (!ctx) {
    throw new Error("useAuctionPorts must be used within AuctionPortsProvider");
  }
  return ctx;
}

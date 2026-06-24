"use client";

import { useRealtimeHealthPortOptional } from "@/lib/connection/realtime-health-provider";
import { useLotPortsOptional } from "@/lib/context/lot-ports";
import type { ConnectionStatus } from "@/lib/realtime/contracts";
import { useEffect, useState } from "react";

const initial: ConnectionStatus = {
  state: "connecting",
  rttMs: null,
  lastSampleAt: null,
  lastBidPropagationMs: null,
};

export function useRealtimeLatency(): ConnectionStatus {
  const contextHealth = useRealtimeHealthPortOptional();
  const lotPorts = useLotPortsOptional();
  const health = contextHealth ?? lotPorts?.health ?? null;
  const [status, setStatus] = useState<ConnectionStatus>(initial);

  useEffect(() => {
    if (!health) return;
    return health.subscribe(setStatus);
  }, [health]);

  return status;
}

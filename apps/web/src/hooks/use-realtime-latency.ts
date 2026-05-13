"use client";

import { useLotPorts } from "@/lib/context/lot-ports";
import type { ConnectionStatus } from "@/lib/realtime/contracts";
import { useEffect, useState } from "react";

const initial: ConnectionStatus = {
  state: "connecting",
  rttMs: null,
  lastSampleAt: null,
  lastBidPropagationMs: null,
};

export function useRealtimeLatency(): ConnectionStatus {
  const { health } = useLotPorts();
  const [status, setStatus] = useState<ConnectionStatus>(initial);

  useEffect(() => health.subscribe(setStatus), [health]);

  return status;
}

"use client";

import { LatencyBadge } from "@/components/sections/artwork/online/latency-badge";
import { useRealtimeLatency } from "@/hooks/use-realtime-latency";
import { useLotPorts } from "@/lib/context/lot-ports";
import { useEffect } from "react";

type Props = {
  lotId: string;
  className?: string;
};

export function LatencyBadgeContainer({ lotId, className }: Props) {
  const { health } = useLotPorts();
  const status = useRealtimeLatency();

  useEffect(() => {
    health.setBidPropagationLotId(lotId);
    return () => {
      health.setBidPropagationLotId(null);
    };
  }, [health, lotId]);

  return (
    <LatencyBadge
      status={status}
      {...(className !== undefined && className !== "" ? { className } : {})}
    />
  );
}

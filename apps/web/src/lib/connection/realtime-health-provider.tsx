"use client";

import type { RealtimeHealthPort } from "@/lib/realtime/contracts";
import { createSocketHealthAdapter } from "@/lib/realtime/socket-health-adapter";
import { type ReactNode, createContext, useContext, useMemo } from "react";

const RealtimeHealthContext = createContext<RealtimeHealthPort | null>(null);

type Props = {
  children: ReactNode;
  /** Inject a fake health port in tests. */
  health?: RealtimeHealthPort;
};

/** Provides the shared socket health port for live marketing surfaces. */
export function RealtimeHealthProvider({ children, health }: Props) {
  const value = useMemo(() => health ?? createSocketHealthAdapter(), [health]);
  return <RealtimeHealthContext.Provider value={value}>{children}</RealtimeHealthContext.Provider>;
}

export function useRealtimeHealthPort(): RealtimeHealthPort {
  const ctx = useContext(RealtimeHealthContext);
  if (!ctx) {
    throw new Error("useRealtimeHealthPort must be used within RealtimeHealthProvider");
  }
  return ctx;
}

/** Returns the health port when a RealtimeHealthProvider is mounted. */
export function useRealtimeHealthPortOptional(): RealtimeHealthPort | null {
  return useContext(RealtimeHealthContext);
}

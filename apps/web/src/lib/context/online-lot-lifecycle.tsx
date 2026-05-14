"use client";

import type { Lot, Sale } from "@auction/types";
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

type SalePick = Pick<Sale, "status" | "deliveryMode"> | null;

type Ctx = {
  lot: Pick<
    Lot,
    "status" | "startTime" | "endTime" | "winnerId" | "reservePrice" | "currentPrice" | "id"
  >;
  sale: SalePick;
  extendedByMs: number | null;
  setExtendedDeltaMs: (deltaMs: number | null) => void;
};

const OnlineLotLifecycleContext = createContext<Ctx | null>(null);

type ProviderProps = {
  lot: Ctx["lot"];
  sale: SalePick;
  children: ReactNode;
};

export function OnlineLotLifecycleProvider({ lot, sale, children }: ProviderProps) {
  const [extendedByMs, setExtendedByMs] = useState<number | null>(null);

  const setExtendedDeltaMs = useCallback((deltaMs: number | null) => {
    setExtendedByMs(deltaMs);
  }, []);

  const value = useMemo(
    () => ({ lot, sale, extendedByMs, setExtendedDeltaMs }),
    [lot, sale, extendedByMs, setExtendedDeltaMs],
  );

  return (
    <OnlineLotLifecycleContext.Provider value={value}>
      {children}
    </OnlineLotLifecycleContext.Provider>
  );
}

export function useOnlineLotLifecycle(): Ctx | null {
  return useContext(OnlineLotLifecycleContext);
}

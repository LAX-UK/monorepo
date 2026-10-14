"use client";

import { type ReactNode, createContext, useContext } from "react";
import type { SmoothScrollEngine } from "./engine.js";
import { createNativeEngine } from "./native-engine.js";

const fallbackEngine = createNativeEngine();

export type SmoothScrollContextValue = Pick<SmoothScrollEngine, "scrollTo">;

const SmoothScrollContext = createContext<SmoothScrollContextValue>(fallbackEngine);

export function SmoothScrollProvider({
  value,
  children,
}: {
  value: SmoothScrollContextValue;
  children: ReactNode;
}) {
  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}

export function useSmoothScroll(): SmoothScrollContextValue {
  return useContext(SmoothScrollContext);
}

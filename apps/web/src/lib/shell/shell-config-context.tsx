"use client";

import type { ShellConfig } from "@/lib/shell/contracts";
import { type ReactNode, createContext, useContext } from "react";

const ShellConfigContext = createContext<ShellConfig | null>(null);

export function ShellConfigProvider({
  config,
  children,
}: {
  config: ShellConfig;
  children: ReactNode;
}) {
  return <ShellConfigContext.Provider value={config}>{children}</ShellConfigContext.Provider>;
}

export function useShellConfig(): ShellConfig {
  const ctx = useContext(ShellConfigContext);
  if (!ctx) {
    throw new Error("useShellConfig must be used within ShellConfigProvider");
  }
  return ctx;
}

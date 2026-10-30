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

/** The shell config when a frame provides one; `null` in frames that have none (the workspace). */
export function useOptionalShellConfig(): ShellConfig | null {
  return useContext(ShellConfigContext);
}

export function useShellConfig(): ShellConfig {
  const ctx = useContext(ShellConfigContext);
  if (!ctx) {
    throw new Error("useShellConfig must be used within ShellConfigProvider");
  }
  return ctx;
}

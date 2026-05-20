"use client";

import {
  type HotkeyScope,
  getActiveHotkeyScope,
  popHotkeyScope,
  pushHotkeyScope,
} from "@/lib/hotkeys/hotkey-registry";
import { createContext, useContext, useEffect } from "react";

const HotkeyScopeContext = createContext<HotkeyScope>("global");

export function HotkeyScopeProvider({
  scope,
  children,
}: {
  scope: HotkeyScope;
  children: React.ReactNode;
}) {
  useEffect(() => {
    pushHotkeyScope(scope);
    return () => popHotkeyScope(scope);
  }, [scope]);

  return <HotkeyScopeContext.Provider value={scope}>{children}</HotkeyScopeContext.Provider>;
}

export function useHotkeyScope(): HotkeyScope {
  return useContext(HotkeyScopeContext) ?? getActiveHotkeyScope();
}

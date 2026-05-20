"use client";

import { HotkeyHelpDialog } from "@/lib/hotkeys/hotkey-help-dialog";
import {
  getActiveHotkeyScope,
  listHotkeysForScope,
  subscribeHotkeys,
} from "@/lib/hotkeys/hotkey-registry";
import type { HotkeyScope } from "@/lib/hotkeys/hotkey-registry";
import { isEditableTarget } from "@/lib/hotkeys/is-editable-target";
import { HotkeyScopeProvider } from "@/lib/hotkeys/use-hotkey-scope";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { tinykeys } from "tinykeys";

type HotkeyProviderValue = {
  openHelp: () => void;
};

const HotkeyUiContext = createContext<HotkeyProviderValue>({ openHelp: () => {} });

export function useHotkeyUi(): HotkeyProviderValue {
  return useContext(HotkeyUiContext);
}

type Props = {
  scope?: HotkeyScope;
  children: React.ReactNode;
};

/** Mounts tinykeys listeners for all registry bindings; ignores editable targets. */
export function HotkeyProvider({ scope = "global", children }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [registryVersion, setRegistryVersion] = useState(0);

  const openHelp = useCallback(() => setHelpOpen(true), []);

  useEffect(() => subscribeHotkeys(() => setRegistryVersion((n) => n + 1)), []);

  const bindings = useMemo(() => {
    void registryVersion;
    return listHotkeysForScope(getActiveHotkeyScope());
  }, [registryVersion]);

  useEffect(() => {
    const keyMap: Record<string, (event: KeyboardEvent) => void> = {};
    for (const binding of bindings) {
      keyMap[binding.keys] = (event: KeyboardEvent) => {
        if (isEditableTarget(event.target)) return;
        if (binding.when && !binding.when()) return;
        binding.handler(event);
      };
    }
    if (Object.keys(keyMap).length === 0) return;
    return tinykeys(window, keyMap);
  }, [bindings]);

  return (
    <HotkeyScopeProvider scope={scope}>
      <HotkeyUiContext.Provider value={{ openHelp }}>
        {children}
        <HotkeyHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </HotkeyUiContext.Provider>
    </HotkeyScopeProvider>
  );
}

"use client";

import { HotkeyHelpDialog } from "@/lib/hotkeys/hotkey-help-dialog";
import {
  bindingKeys,
  getActiveHotkeyScope,
  listHotkeysForScope,
  subscribeHotkeys,
} from "@/lib/hotkeys/hotkey-registry";
import type { HotkeyScope } from "@/lib/hotkeys/hotkey-registry";
import { isEditableTarget } from "@/lib/hotkeys/is-editable-target";
import { HotkeyScopeProvider } from "@/lib/hotkeys/use-hotkey-scope";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { tinykeys } from "tinykeys";

type HotkeyProviderValue = {
  openHelp: () => void;
};

const HotkeyUiContext = createContext<HotkeyProviderValue>({ openHelp: () => {} });

export function useHotkeyUi(): HotkeyProviderValue {
  return useContext(HotkeyUiContext);
}

/** The `?` list, drawn by the shell that mounts the provider. */
export type HotkeyHelpRenderer = (props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => ReactNode;

const defaultHelp: HotkeyHelpRenderer = (props) => <HotkeyHelpDialog {...props} />;

type Props = {
  scope?: HotkeyScope;
  /** Draws the shortcut list; each shell passes its own kit's dialog. */
  renderHelp?: HotkeyHelpRenderer;
  children: ReactNode;
};

/** Mounts tinykeys listeners for all registry bindings; ignores editable targets. */
export function HotkeyProvider({ scope = "global", renderHelp = defaultHelp, children }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [registryVersion, setRegistryVersion] = useState(0);

  const openHelp = useCallback(() => setHelpOpen(true), []);

  useEffect(() => {
    const bump = () => setRegistryVersion((n) => n + 1);
    const unsubscribe = subscribeHotkeys(bump);
    // Children register in their effects, which run before this one: read what they added.
    bump();
    return unsubscribe;
  }, []);

  const bindings = useMemo(() => {
    void registryVersion;
    return listHotkeysForScope(getActiveHotkeyScope());
  }, [registryVersion]);

  useEffect(() => {
    const keyMap: Record<string, (event: KeyboardEvent) => void> = {};
    for (const binding of bindings) {
      if (binding.passive) continue;
      const run = (event: KeyboardEvent) => {
        if (isEditableTarget(event.target)) return;
        if (binding.when && !binding.when()) return;
        binding.handler(event);
      };
      for (const keys of bindingKeys(binding)) keyMap[keys] = run;
    }
    if (Object.keys(keyMap).length === 0) return;
    return tinykeys(window, keyMap);
  }, [bindings]);

  const value = useMemo(() => ({ openHelp }), [openHelp]);

  return (
    <HotkeyScopeProvider scope={scope}>
      <HotkeyUiContext.Provider value={value}>
        {children}
        {renderHelp({ open: helpOpen, onOpenChange: setHelpOpen })}
      </HotkeyUiContext.Provider>
    </HotkeyScopeProvider>
  );
}

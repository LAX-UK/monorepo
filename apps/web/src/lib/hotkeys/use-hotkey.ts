"use client";

import {
  type HotkeyBinding,
  type HotkeyScope,
  registerHotkey,
} from "@/lib/hotkeys/hotkey-registry";
import { useHotkeyScope } from "@/lib/hotkeys/use-hotkey-scope";
import { useEffect, useRef } from "react";

type UseHotkeyOptions = {
  id: string;
  keys: string;
  label: string;
  description?: string;
  group: string;
  scope?: HotkeyScope;
  handler: (event: KeyboardEvent) => void;
  when?: () => boolean;
  enabled?: boolean;
};

/** Register a hotkey for the lifetime of the calling component. */
export function useHotkey({
  id,
  keys,
  label,
  description,
  group,
  handler,
  when,
  scope: scopeOverride,
  enabled = true,
}: UseHotkeyOptions): void {
  const scope = useHotkeyScope();
  const handlerRef = useRef(handler);
  const whenRef = useRef(when);

  handlerRef.current = handler;
  whenRef.current = when;

  useEffect(() => {
    if (!enabled) return;
    const binding: HotkeyBinding = {
      id,
      keys,
      label,
      ...(description ? { description } : {}),
      group,
      scope: scopeOverride ?? scope,
      handler: (event) => handlerRef.current(event),
      ...(whenRef.current ? { when: () => whenRef.current?.() ?? true } : {}),
    };
    return registerHotkey(binding);
  }, [id, keys, label, description, group, scope, scopeOverride, enabled]);
}

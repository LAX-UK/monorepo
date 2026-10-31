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
  alternateKeys?: readonly string[];
  order?: number;
  passive?: boolean;
  hidden?: boolean;
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
  alternateKeys,
  order,
  passive,
  hidden,
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
  const alternates = alternateKeys?.join("\n") ?? "";

  handlerRef.current = handler;
  whenRef.current = when;

  useEffect(() => {
    if (!enabled) return;
    const binding: HotkeyBinding = {
      id,
      keys,
      ...(alternates ? { alternateKeys: alternates.split("\n") } : {}),
      ...(order !== undefined ? { order } : {}),
      ...(passive ? { passive } : {}),
      ...(hidden ? { hidden } : {}),
      label,
      ...(description ? { description } : {}),
      group,
      scope: scopeOverride ?? scope,
      handler: (event) => handlerRef.current(event),
      ...(whenRef.current ? { when: () => whenRef.current?.() ?? true } : {}),
    };
    return registerHotkey(binding);
  }, [
    id,
    keys,
    alternates,
    order,
    passive,
    hidden,
    label,
    description,
    group,
    scope,
    scopeOverride,
    enabled,
  ]);
}

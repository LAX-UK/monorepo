"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { isEditableTarget } from "@/lib/hotkeys/is-editable-target";
import { useEffect } from "react";

/** Reliable document listener for ⌘K / Ctrl+K — works before tinykeys bindings attach. */
export function useCommandPaletteHotkey(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      openCommandPalette();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

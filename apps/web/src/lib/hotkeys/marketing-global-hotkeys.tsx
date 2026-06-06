"use client";

import { useCommandPaletteHotkey } from "@/lib/hotkeys/use-command-palette-hotkey";

/** Marketing shell: open command palette from the header ⌘K / Ctrl+K hint. */
export function MarketingGlobalHotkeys() {
  useCommandPaletteHotkey();
  return null;
}

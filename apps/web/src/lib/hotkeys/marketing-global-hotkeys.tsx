"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { useEffect } from "react";

/** Marketing shell: open command palette from the header ⌘K / Ctrl+K hint. */
export function MarketingGlobalHotkeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      openCommandPalette();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}

"use client";

import { KbdHintMuted } from "@/components/marketing/kbd-hint";
import { useEffect, useState } from "react";

export function PaletteFooter() {
  const [modLabel, setModLabel] = useState("Ctrl");

  useEffect(() => {
    setModLabel(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘" : "Ctrl");
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-hairline px-3 py-2 font-body text-xs text-on-surface-variant">
      <span>
        <KbdHintMuted>↑↓</KbdHintMuted> Navigate
      </span>
      <span>
        <KbdHintMuted>↵</KbdHintMuted> Open
      </span>
      <span>
        <KbdHintMuted>Esc</KbdHintMuted> Close
      </span>
      <span className="ml-auto hidden sm:inline">
        <KbdHintMuted>{modLabel}+K</KbdHintMuted> Search
      </span>
    </div>
  );
}

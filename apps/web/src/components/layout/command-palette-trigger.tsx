"use client";

import { cn } from "@auction/ui";
import { useEffect, useState } from "react";

function openPalette() {
  window.dispatchEvent(new Event("lax-command-palette-open"));
}

export function CommandPaletteTrigger({ className = "" }: { className?: string }) {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        "hidden min-h-10 shrink-0 items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-low/80 px-3 py-1.5 font-mono text-xs text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:inline-flex",
        className,
      )}
      aria-label="Open quick navigation"
    >
      <span className="font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface-variant">
        Search
      </span>
      <kbd className="rounded border border-outline-variant/50 bg-surface px-1.5 py-0.5 text-[0.65rem] font-medium text-on-surface">
        {isMac ? "⌘K" : "Ctrl+K"}
      </kbd>
    </button>
  );
}

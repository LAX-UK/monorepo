"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { cn } from "@auction/ui";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

/** Clickable hint for command palette discoverability on admin list empty states. */
export function CommandPaletteHint({ className }: { className?: string }) {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  const shortcut = isMac ? "⌘K" : "Ctrl+K";

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Open search"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-body text-xs text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <Search className="size-3.5 shrink-0 opacity-70" aria-hidden />
      Press{" "}
      <kbd className="rounded border border-border-hairline bg-surface px-1 py-0.5 font-mono text-[10px]">
        {shortcut}
      </kbd>{" "}
      to find any admin page or record.
    </button>
  );
}

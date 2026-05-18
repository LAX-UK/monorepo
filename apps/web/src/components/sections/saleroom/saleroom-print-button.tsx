"use client";

import { Button } from "@auction/ui/components/button";
import { Printer } from "lucide-react";
import { useCallback } from "react";

type Props = {
  /** "text" matches Figma hero toolbar (no border, uppercase label). */
  appearance?: "default" | "text";
};

/** Thin client wrapper around `window.print()` — kept as its own component (SRP). */
export function SaleroomPrintButton({ appearance = "default" }: Props) {
  const print = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);

  if (appearance === "text") {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={print}
        className="inline-flex h-10 items-center gap-1.5 rounded-none px-0 font-['DM_Sans',sans-serif] text-sm font-medium uppercase leading-[21px] text-nav-text hover:bg-transparent hover:opacity-80 dark:text-on-surface"
        aria-label="Print catalogue"
      >
        <Printer
          className="size-5 shrink-0 text-black dark:text-on-surface"
          strokeWidth={1}
          aria-hidden
        />
        Print
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={print}
      className="h-auto min-h-11 rounded-full border-outline-variant/60 bg-transparent px-5 py-2.5 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:border-primary hover:bg-transparent hover:text-primary"
      aria-label="Print catalogue"
    >
      <Printer className="text-base" aria-hidden />
      Print
    </Button>
  );
}

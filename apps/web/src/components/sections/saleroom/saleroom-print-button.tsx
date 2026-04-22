"use client";

import { Button } from "@auction/ui/components/button";
import { Printer } from "lucide-react";
import { useCallback } from "react";

/** Thin client wrapper around `window.print()` — kept as its own component (SRP). */
export function SaleroomPrintButton() {
  const print = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={print}
      className="h-auto min-h-11 rounded-full border-outline-variant/60 bg-transparent px-5 py-2.5 font-label text-xs font-bold uppercase tracking-widest text-on-surface hover:border-primary hover:bg-transparent hover:text-primary"
      aria-label="Print catalogue"
    >
      <Printer className="text-base" aria-hidden />
      Print
    </Button>
  );
}

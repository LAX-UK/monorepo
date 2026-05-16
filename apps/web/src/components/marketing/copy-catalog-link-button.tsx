"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Check, Link2 } from "lucide-react";
import { useCallback, useState } from "react";

export function CopyCatalogLinkButton() {
  const [done, setDone] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "shrink-0 gap-1.5 font-label text-[10px] uppercase tracking-wider",
        "min-w-11 px-3 sm:min-w-0 sm:px-3",
        "motion-safe:active:scale-105 motion-reduce:active:scale-100",
      )}
      aria-label={done ? "Catalog link copied" : "Copy catalog link"}
      onClick={() => void copy()}
    >
      {done ? (
        <Check className="size-3.5 tick-in" aria-hidden />
      ) : (
        <Link2 className="size-3.5" aria-hidden />
      )}
      <span className="hidden sm:inline">{done ? "Copied" : "Copy link"}</span>
    </Button>
  );
}

"use client";

import { useDensityToggle } from "@/components/layout/density-provider";
import { Button } from "@auction/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@auction/ui/components/popover";
import { Columns3, Rows3, SlidersHorizontal } from "lucide-react";

export function TweaksPopover() {
  const { density, toggleDensity } = useDensityToggle();
  const isCompact = density === "compact";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] text-secondary hover:bg-surface-container-low hover:text-primary"
          aria-label="Open density settings"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 border-outline-variant bg-surface-container-lowest"
      >
        <PopoverHeader>
          <PopoverTitle>Display settings</PopoverTitle>
        </PopoverHeader>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-label text-xs font-semibold uppercase tracking-[0.18em] text-on-surface">
                Density
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {isCompact ? "Compact rows and spacing" : "Comfortable rows and spacing"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-10 min-w-10 border-outline-variant/40 text-secondary hover:bg-surface-container-low hover:text-primary"
              onClick={toggleDensity}
              aria-label={
                isCompact ? "Use normal dashboard density" : "Use compact dashboard density"
              }
              aria-pressed={isCompact}
            >
              {isCompact ? (
                <Rows3 className="size-4" aria-hidden />
              ) : (
                <Columns3 className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useDashboardDensity, useDensityToggle } from "@/components/layout/density-provider";
import { HydrationDeferred } from "@/components/layout/hydration-deferred";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@auction/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@auction/ui/components/popover";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { Columns3, Rows3, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

type TweaksPopoverProps = {
  /** Sections rendered inside the popover. Defaults preserve the historical
   * order: density first, then theme. Pass an explicit array to compose other
   * surfaces without forking this component.
   */
  sections?: ReactNode[];
};

export function TweaksPopover({ sections }: TweaksPopoverProps = {}) {
  const resolved = sections ?? [
    <DensityTweakSection key="density" />,
    <ThemeTweakSection key="theme" />,
  ];

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="min-h-[44px] min-w-[44px] text-secondary hover:bg-surface-container-low hover:text-link"
      aria-label="Open display settings"
    >
      <SlidersHorizontal className="size-4" aria-hidden />
    </Button>
  );

  return (
    <HydrationDeferred
      fallback={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] text-secondary"
          aria-label="Open display settings"
          disabled
          aria-busy
        >
          <SlidersHorizontal className="size-4" aria-hidden />
        </Button>
      }
    >
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-72 border-outline-variant bg-surface-container-lowest"
        >
          <PopoverHeader>
            <PopoverTitle>Display settings</PopoverTitle>
          </PopoverHeader>
          <div className="mt-4 flex flex-col gap-5">{resolved}</div>
        </PopoverContent>
      </Popover>
    </HydrationDeferred>
  );
}

export function DensityTweakSection() {
  const { density, toggleDensity } = useDensityToggle();
  const { setDensity } = useDashboardDensity();
  const isCompact = density === "compact";

  return (
    <section aria-labelledby="tweaks-density-label" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p
            id="tweaks-density-label"
            className="font-label text-xs font-semibold uppercase tracking-[0.18em] text-on-surface"
          >
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
          className="min-h-10 min-w-10 border-outline-variant/40 text-secondary hover:bg-surface-container-low hover:text-link"
          onClick={toggleDensity}
          aria-label={
            isCompact ? "Use comfortable dashboard density" : "Use compact dashboard density"
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
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Choose dashboard density</legend>
        <RadioGroup
          value={density}
          onValueChange={(v) => setDensity(v as "normal" | "compact")}
          className="grid grid-cols-2 gap-2"
          aria-labelledby="tweaks-density-label"
        >
          <DensityRadio label="Comfortable" value="normal" />
          <DensityRadio label="Compact" value="compact" />
        </RadioGroup>
      </fieldset>
    </section>
  );
}

function DensityRadio({ label, value }: { label: string; value: string }) {
  const id = `density-${value}`;
  return (
    <label
      htmlFor={id}
      className={[
        "flex min-h-10 cursor-pointer items-center justify-center rounded-sm border px-3 py-2 font-label text-xs font-semibold uppercase tracking-[0.08em] transition-colors has-[[data-state=checked]]:border-on-surface has-[[data-state=checked]]:bg-surface-container has-[[data-state=checked]]:text-on-surface",
        "border-outline-variant/40 text-on-surface-variant hover:border-on-surface/60 hover:text-on-surface",
      ].join(" ")}
    >
      <RadioGroupItem id={id} value={value} className="sr-only" />
      {label}
    </label>
  );
}

export function ThemeTweakSection() {
  return (
    <section
      aria-labelledby="tweaks-theme-label"
      className="flex items-center justify-between gap-4 border-t border-outline-variant/40 pt-4"
    >
      <div>
        <p
          id="tweaks-theme-label"
          className="font-label text-xs font-semibold uppercase tracking-[0.18em] text-on-surface"
        >
          Dark mode
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">Toggle the colour scheme.</p>
      </div>
      <ThemeToggle />
    </section>
  );
}

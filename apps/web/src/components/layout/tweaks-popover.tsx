"use client";

import { useDashboardDensity, useDensityToggle } from "@/components/layout/density-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@auction/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@auction/ui/components/popover";
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] text-secondary hover:bg-surface-container-low hover:text-primary"
          aria-label="Open display settings"
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
        <div className="mt-4 flex flex-col gap-5">{resolved}</div>
      </PopoverContent>
    </Popover>
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
          className="min-h-10 min-w-10 border-outline-variant/40 text-secondary hover:bg-surface-container-low hover:text-primary"
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
        <div
          role="radiogroup"
          aria-labelledby="tweaks-density-label"
          className="grid grid-cols-2 gap-2"
        >
          <DensityRadio
            label="Comfortable"
            checked={!isCompact}
            onSelect={() => setDensity("normal")}
          />
          <DensityRadio
            label="Compact"
            checked={isCompact}
            onSelect={() => setDensity("compact")}
          />
        </div>
      </fieldset>
    </section>
  );
}

function DensityRadio({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={[
        "flex min-h-10 cursor-pointer items-center justify-center rounded-sm border px-3 py-2 font-label text-xs font-semibold uppercase tracking-[0.08em] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
        checked
          ? "border-on-surface bg-surface-container text-on-surface"
          : "border-outline-variant/40 text-on-surface-variant hover:border-on-surface/60 hover:text-on-surface",
      ].join(" ")}
    >
      <input
        type="radio"
        name="dashboard-density"
        checked={checked}
        onChange={() => onSelect()}
        className="sr-only"
      />
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

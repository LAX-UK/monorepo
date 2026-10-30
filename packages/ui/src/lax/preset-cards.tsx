"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../lib/utils.js";

export type PresetOption<T extends string> = {
  value: T;
  label: string;
  /** One sentence on what this choice does. */
  description?: string;
  /** A short tag beside the title: "Recommended". */
  tag?: React.ReactNode;
  /** Unavailable; the reason replaces the description ("Available once you bid"). */
  disabledReason?: string;
};

/** Columns by the width of the space the cards sit in, so they never squeeze in a narrow panel. */
const COLUMNS = {
  1: "grid-cols-1",
  2: "grid-cols-1 @md:grid-cols-2",
  3: "grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-3",
} as const;

/**
 * A choose-one setting as cards: alert styles, export formats. A radio group, so arrows move
 * between cards and the choice follows focus. The chosen card has a 2px ink edge and a filled
 * radio, so it is unmistakable in both themes without colour; a disabled card says why.
 */
export function PresetCards<T extends string>({
  value,
  onValueChange,
  options,
  label,
  columns = 3,
  compact = false,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly PresetOption<T>[];
  /** The group's accessible name: "Alert style". */
  label: string;
  columns?: keyof typeof COLUMNS;
  /** Rows only as tall as their words: a list of choices in a dialog, not a settings page. */
  compact?: boolean;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("@container", className)}>
      <RadioGroupPrimitive.Root
        value={value}
        aria-label={label}
        onValueChange={(next) => {
          const match = options.find((option) => option.value === next);
          if (match) onValueChange(match.value);
        }}
        className={cn("grid gap-3", COLUMNS[columns])}
      >
        {options.map((option) => {
          const titleId = `${id}-${option.value}-title`;
          const detailId = `${id}-${option.value}-detail`;
          const detail = option.disabledReason ?? option.description;
          return (
            <RadioGroupPrimitive.Item
              key={option.value}
              value={option.value}
              disabled={Boolean(option.disabledReason)}
              aria-labelledby={titleId}
              {...(detail ? { "aria-describedby": detailId } : {})}
              className={cn(
                "group/preset relative flex min-h-24 flex-col items-start rounded-lax-card border bg-lax-surface py-4 pr-4 pl-12 text-left",
                "border-lax-line-strong transition-[border-color,box-shadow] duration-150 ease-out",
                "hover:border-lax-control-edge lax-focus",
                "data-[state=checked]:border-lax-ink data-[state=checked]:shadow-[inset_0_0_0_1px_var(--lax-ink)]",
                "disabled:cursor-not-allowed disabled:border-lax-line disabled:hover:border-lax-line",
                "max-sm:min-h-0 max-sm:py-3",
                compact && "min-h-0 py-3",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-[18px] left-4 size-[18px] rounded-full border-[1.5px] border-lax-control-edge bg-lax-surface",
                  "group-data-[state=checked]/preset:border-[5.5px] group-data-[state=checked]/preset:border-lax-ink",
                  "group-disabled/preset:border-lax-line-strong",
                  "max-sm:top-[14px]",
                  compact && "top-[14px]",
                )}
              />
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  id={titleId}
                  className={cn(
                    "text-lax-14 font-semibold",
                    option.disabledReason ? "text-lax-muted" : "text-lax-fg",
                  )}
                >
                  {option.label}
                </span>
                {option.tag}
              </span>
              {detail ? (
                <span id={detailId} className="mt-1 text-lax-13 text-lax-muted">
                  {detail}
                </span>
              ) : null}
            </RadioGroupPrimitive.Item>
          );
        })}
      </RadioGroupPrimitive.Root>
    </div>
  );
}

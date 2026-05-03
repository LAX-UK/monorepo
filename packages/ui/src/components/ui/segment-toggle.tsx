"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export type SegmentToggleOption<TValue extends string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};

export type SegmentToggleProps<TValue extends string> = {
  options: SegmentToggleOption<TValue>[];
  value: TValue;
  onValueChange: (value: TValue) => void;
  "aria-label": string;
  className?: string;
};

export function SegmentToggle<TValue extends string>({
  options,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  className,
}: SegmentToggleProps<TValue>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-outline-variant/40 bg-surface-container-low p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "min-h-8 rounded-full px-3 font-label text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

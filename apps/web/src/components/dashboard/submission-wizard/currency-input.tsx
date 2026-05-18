"use client";

import { UnderlineInput } from "@/components/ui/input";
import { normalizeCurrencyInput } from "@/lib/forms/submission/submission-currency";
import { cn } from "@auction/ui";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof UnderlineInput>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

export function CurrencyInput({ value, onChange, className, ...props }: Props) {
  return (
    <div className={cn("relative", className)}>
      <span
        className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-label text-sm text-on-surface-variant"
        aria-hidden
      >
        £
      </span>
      <UnderlineInput
        {...props}
        inputMode="decimal"
        className="pl-5"
        value={value}
        onChange={(e) => onChange(normalizeCurrencyInput(e.target.value))}
        onBlur={(e) => onChange(normalizeCurrencyInput(e.target.value))}
      />
    </div>
  );
}

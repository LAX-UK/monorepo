"use client";

import { normalizeCurrencyInput } from "@/lib/forms/submission/submission-currency";
import { cn } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Input>, "onChange" | "value" | "variant"> & {
  value: string;
  onChange: (value: string) => void;
};

export function CurrencyInput({ value, onChange, className, ...props }: Props) {
  return (
    <div className={cn("relative", className)}>
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-label text-sm text-on-surface-variant"
        aria-hidden
      >
        £
      </span>
      <Input
        {...props}
        inputMode="decimal"
        className="pl-7"
        value={value}
        onChange={(e) => onChange(normalizeCurrencyInput(e.target.value))}
        onBlur={(e) => onChange(normalizeCurrencyInput(e.target.value))}
      />
    </div>
  );
}

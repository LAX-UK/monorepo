"use client";

import { formatMoney } from "@/lib/format-currency";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Minus, Plus } from "lucide-react";
import { useId, useMemo } from "react";

type Props = {
  /** Current bid amount as decimal string (e.g. "700000.00") */
  amount: string;
  minNumeric: number;
  /** Minimum raise (e.g. from `lot.minBidIncrement`) */
  stepNumeric: number;
  disabled?: boolean;
  onAmountChange: (next: string) => void;
  className?: string;
};

function parseAmount(s: string): number {
  const n = Number.parseFloat(s.trim() === "" ? "0" : s);
  return Number.isFinite(n) ? n : 0;
}

/** Mockup-aligned minus / Your amount / plus row (controlled). */
export function BidStepper({
  amount,
  minNumeric,
  stepNumeric,
  disabled = false,
  onAmountChange,
  className,
}: Props) {
  const liveId = useId();
  const numeric = useMemo(() => parseAmount(amount), [amount]);
  const step = Number.isFinite(stepNumeric) && stepNumeric > 0 ? stepNumeric : 1;
  const min = minNumeric;
  const display = amount.trim() === "" ? formatMoney(min.toFixed(2)) : formatMoney(amount);

  const dec = () => {
    const next = Math.max(min, numeric - step);
    onAmountChange(next.toFixed(2));
  };

  const inc = () => {
    const next = numeric <= 0 ? min : numeric + step;
    onAmountChange(Math.max(min, next).toFixed(2));
  };

  const atMin = numeric <= min + 1e-9;

  return (
    <div className={cn("flex w-full items-center gap-4", className)}>
      <Button
        type="button"
        variant="ghost"
        aria-label="Decrease bid"
        disabled={disabled || atMin}
        onClick={dec}
        className="flex size-12 shrink-0 items-center justify-center rounded-[4px] outline outline-1 outline-offset-[-1px] outline-outline-variant transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-surface/20 disabled:opacity-40 dark:focus-visible:ring-white/20"
      >
        <Minus className="size-5 text-on-surface" aria-hidden />
      </Button>
      <div
        className="flex min-h-14 flex-1 flex-col items-center justify-center gap-2 rounded-[4px] px-8 py-3 outline outline-1 outline-offset-[-1px] outline-outline-variant"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          id={`${liveId}-label`}
          className="text-center font-body text-[10px] font-semibold uppercase leading-[10px] text-on-surface-variant"
        >
          Your amount
        </span>
        <span
          className="text-center font-body text-base font-semibold tracking-wide text-on-surface"
          aria-labelledby={`${liveId}-label`}
        >
          {display}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        aria-label="Increase bid"
        disabled={disabled}
        onClick={inc}
        className="flex size-12 shrink-0 items-center justify-center rounded-[4px] outline outline-1 outline-offset-[-1px] outline-outline-variant transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-surface/20 disabled:opacity-40 dark:focus-visible:ring-white/20"
      >
        <Plus className="size-5 text-on-surface" aria-hidden />
      </Button>
    </div>
  );
}

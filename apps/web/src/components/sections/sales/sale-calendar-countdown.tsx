"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { closingChipText } from "@/lib/time/opens-line";
import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import { Countdown } from "@auction/ui/components/countdown";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  endIso: string;
  className?: string;
};

/** Countdown for calendar live badge; static end when reduced motion. */
export function SaleCalendarCountdown({ endIso, className }: Props) {
  const reduced = useReducedMotion();
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return null;

  if (reduced) {
    return (
      <span
        className={cn(
          "text-center font-body text-sm font-semibold leading-4 tabular-nums text-cta-on",
          className,
        )}
      >
        {formatWhen(end, LONDON_TIME_ZONE, new Date())}
      </span>
    );
  }

  return (
    <Countdown
      end={end}
      format={closingChipText}
      variant="default"
      className={cn(
        "text-center font-body text-sm font-semibold leading-4 tabular-nums text-cta-on",
        className,
      )}
      announce={false}
    />
  );
}

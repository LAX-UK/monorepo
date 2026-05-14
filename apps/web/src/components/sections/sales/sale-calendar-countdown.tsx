"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Countdown, cn } from "@auction/ui";

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
        {end.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
      </span>
    );
  }

  return (
    <Countdown
      end={end}
      variant="default"
      className={cn(
        "text-center font-body text-sm font-semibold leading-4 tabular-nums text-cta-on",
        className,
      )}
      announce={false}
    />
  );
}

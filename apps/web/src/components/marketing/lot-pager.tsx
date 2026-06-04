import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  prevHref: string | null;
  nextHref: string | null;
  /** e.g. "3 / 48" — position of the current lot within the sale. */
  positionLabel: string | null;
  className?: string;
};

const stepBase =
  "inline-flex size-9 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none";
const stepEnabled =
  "border-outline-variant/50 text-on-surface hover:border-primary/40 hover:text-primary";
const stepDisabled = "cursor-not-allowed border-outline-variant/30 text-on-surface-variant/40";

/** Prev/next pager that walks the sibling lots of the current sale on the lot PDP. */
export function LotPager({ prevHref, nextHref, positionLabel, className }: Props) {
  if (!prevHref && !nextHref) return null;

  return (
    <nav aria-label="Lot navigation" className={cn("flex items-center gap-2", className)}>
      {prevHref ? (
        <Link
          href={prevHref}
          aria-label="Previous lot"
          className={cn(stepBase, stepEnabled, FOCUS_RING)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className={cn(stepBase, stepDisabled)}>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {positionLabel ? (
        <span className="min-w-14 text-center font-label text-[0.7rem] font-semibold uppercase tracking-wider text-on-surface-variant tabular-nums">
          {positionLabel}
        </span>
      ) : null}
      {nextHref ? (
        <Link
          href={nextHref}
          aria-label="Next lot"
          className={cn(stepBase, stepEnabled, FOCUS_RING)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className={cn(stepBase, stepDisabled)}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}

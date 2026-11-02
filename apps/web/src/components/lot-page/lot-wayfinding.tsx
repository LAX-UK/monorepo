import { ButtonLink } from "@auction/ui/lax";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  backHref: string;
  backLabel: string;
  prevHref: string | null;
  nextHref: string | null;
  /** "4 / 8": the lot's place in the sale. */
  positionLabel: string | null;
};

/** "4 / 8" reads as "Lot 4 of 8". */
export function lotPositionText(label: string | null): string | null {
  if (!label) return null;
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(label.trim());
  return match ? `Lot ${match[1]} of ${match[2]}` : label;
}

function Step({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: ReactNode;
}) {
  return href ? (
    <ButtonLink
      href={href}
      Link={Link}
      variant="ghost"
      size="sm"
      aria-label={label}
      className="px-2"
    >
      {children}
    </ButtonLink>
  ) : (
    <span
      aria-hidden
      className="inline-flex h-lax-control-sm items-center px-2 text-lax-disabled-fg [&_svg]:size-4"
    >
      {children}
    </span>
  );
}

/**
 * Where this lot sits: a way back to the sale or search it came from, and the previous and next
 * lot of the sale. Quiet text, so the work is the first thing on the page.
 */
export function LotWayfinding({ backHref, backLabel, prevHref, nextHref, positionLabel }: Props) {
  const position = lotPositionText(positionLabel);
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 pt-4 pb-4 md:pt-5">
      <Link
        href={backHref}
        className="lax-focus inline-flex min-w-0 items-center gap-1.5 rounded-sm text-lax-14 leading-5 font-medium text-lax-muted transition-colors duration-150 hover:text-lax-fg"
      >
        <ArrowLeft aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{backLabel}</span>
      </Link>
      {prevHref || nextHref ? (
        <nav aria-label="Lot navigation" className="flex shrink-0 items-center gap-0.5">
          <Step href={prevHref} label="Previous lot">
            <ChevronLeft aria-hidden />
          </Step>
          {position ? (
            <span className="px-1 text-lax-13 leading-5 text-lax-muted tabular-nums">
              {position}
            </span>
          ) : null}
          <Step href={nextHref} label="Next lot">
            <ChevronRight aria-hidden />
          </Step>
        </nav>
      ) : null}
    </div>
  );
}

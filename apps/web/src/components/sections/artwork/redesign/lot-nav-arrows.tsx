import type { LotHeroVM } from "@/components/sections/artwork/artwork-view-models";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  vm: LotHeroVM;
};

/**
 * Figma: `< 1 of N >` style; uses sibling index when `href`s exist.
 */
export function LotNavArrows({ vm }: Props) {
  const hasNav = Boolean(vm.prevHref || vm.nextHref);
  if (!hasNav) {
    return null;
  }
  return (
    <div className="flex h-10 shrink-0 items-center gap-0.5 text-sm font-medium uppercase text-on-surface">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 min-w-0 gap-0.5 px-1"
        asChild
        disabled={!vm.prevHref}
      >
        {vm.prevHref ? (
          <Link
            href={vm.prevHref}
            aria-label="Previous lot in sale"
            className="inline-flex items-center text-on-surface hover:text-primary"
          >
            <ChevronLeft className="size-5 shrink-0" strokeWidth={2} />
            <span className="hidden sm:inline">Prev</span>
          </Link>
        ) : (
          <span className="pointer-events-none inline-flex items-center gap-0.5 opacity-40">
            <ChevronLeft className="size-5" />
            <span className="hidden sm:inline">Prev</span>
          </span>
        )}
      </Button>
      {vm.positionLabel ? (
        <span className="min-w-[3.25rem] shrink-0 px-1 text-center text-sm font-medium leading-5 text-on-surface">
          {vm.positionLabel}
        </span>
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 min-w-0 gap-0.5 px-1"
        asChild
        disabled={!vm.nextHref}
      >
        {vm.nextHref ? (
          <Link
            href={vm.nextHref}
            aria-label="Next lot in sale"
            className="inline-flex items-center text-on-surface hover:text-primary"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-5 shrink-0" strokeWidth={2} />
          </Link>
        ) : (
          <span className="pointer-events-none inline-flex items-center gap-0.5 opacity-40">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-5" />
          </span>
        )}
      </Button>
    </div>
  );
}

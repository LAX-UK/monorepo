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
    <div className="flex h-10 shrink-0 items-center gap-1 text-[14px] font-medium uppercase text-[#1C170D] dark:text-on-surface">
      <Button variant="ghost" size="icon" className="h-8 w-8" asChild disabled={!vm.prevHref}>
        {vm.prevHref ? (
          <Link
            href={vm.prevHref}
            aria-label="Previous lot"
            className="text-[#050505] dark:text-on-surface"
          >
            <ChevronLeft className="size-5" strokeWidth={2} />
          </Link>
        ) : (
          <span className="pointer-events-none opacity-40">
            <ChevronLeft className="size-5" />
          </span>
        )}
      </Button>
      {vm.positionLabel ? (
        <span className="min-w-[3rem] shrink-0 text-center text-[14px] font-medium leading-[21px]">
          {vm.positionLabel}
        </span>
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8" asChild disabled={!vm.nextHref}>
        {vm.nextHref ? (
          <Link
            href={vm.nextHref}
            aria-label="Next lot"
            className="text-[#050505] dark:text-on-surface"
          >
            <ChevronRight className="size-5" strokeWidth={2} />
          </Link>
        ) : (
          <span className="pointer-events-none opacity-40">
            <ChevronRight className="size-5" />
          </span>
        )}
      </Button>
    </div>
  );
}

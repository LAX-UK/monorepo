import type { LotHeroVM } from "@/components/sections/artwork/artwork-view-models";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  vm: LotHeroVM;
};

/**
 * Figma: uppercase trail `Auctions` › sale › lot number.
 */
export function LotBreadcrumbTabs({ vm }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-h-10 flex-wrap items-center gap-2 text-sm font-medium leading-5 uppercase text-on-surface"
    >
      {vm.homeSegment ? (
        <>
          <Link
            href={vm.homeSegment.href}
            className="shrink-0 transition-opacity hover:opacity-80"
          >
            {vm.homeSegment.label}
          </Link>
          <ChevronRight className="size-5 shrink-0 text-on-surface" aria-hidden />
        </>
      ) : (
        <>
          <Link href={vm.firstSegmentHref} className="shrink-0 transition-opacity hover:opacity-80">
            {vm.firstSegmentLabel}
          </Link>
          <ChevronRight className="size-5 shrink-0 text-on-surface" aria-hidden />
        </>
      )}
      {vm.saleHref && vm.saleTitle ? (
        <>
          <Link
            href={vm.saleHref}
            className="max-w-[min(20rem,50vw)] truncate transition-opacity hover:opacity-80"
          >
            {vm.saleTitle}
          </Link>
          <ChevronRight className="size-5 shrink-0 text-on-surface" aria-hidden />
        </>
      ) : null}
      {vm.lotNumberLabel ? <span className="shrink-0">{vm.lotNumberLabel}</span> : null}
    </nav>
  );
}

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
      className="flex min-h-10 flex-wrap items-center gap-2 text-[14px] font-medium leading-[21px] uppercase text-[#1C170D] dark:text-on-surface"
    >
      <Link href={vm.firstSegmentHref} className="shrink-0 transition-opacity hover:opacity-80">
        {vm.firstSegmentLabel}
      </Link>
      <ChevronRight
        className="size-5 shrink-0 rotate-[-90deg] text-[#0A0A0A] dark:text-on-surface"
        aria-hidden
      />
      {vm.saleHref && vm.saleTitle ? (
        <>
          <Link
            href={vm.saleHref}
            className="max-w-[min(20rem,50vw)] truncate transition-opacity hover:opacity-80"
          >
            {vm.saleTitle}
          </Link>
          <ChevronRight
            className="size-5 shrink-0 rotate-[-90deg] text-[#0A0A0A] dark:text-on-surface"
            aria-hidden
          />
        </>
      ) : null}
      {vm.lotNumberLabel ? <span className="shrink-0">{vm.lotNumberLabel}</span> : null}
    </nav>
  );
}

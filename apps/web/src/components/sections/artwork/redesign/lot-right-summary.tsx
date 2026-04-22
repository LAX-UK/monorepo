import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  seed: LotSummarySeedVM;
  children: ReactNode;
};

/**
 * Figma: kicker (optional) + title; children = info stack + bid region.
 */
export function LotRightSummary({ seed, children }: Props) {
  return (
    <div className="flex w-full max-w-[550px] flex-col gap-10">
      <div className="flex flex-col gap-2.5">
        {seed.kicker ? (
          <p className="text-base leading-4 text-[#191919] dark:text-brand-500">{seed.kicker}</p>
        ) : null}
        <h1
          id="lot-heading"
          className="text-2xl font-semibold leading-6 text-[#050505] dark:text-on-surface"
        >
          {seed.title}
        </h1>
        <p className="text-base text-[#191919] dark:text-brand-500">
          <Link
            href={seed.sellerHref}
            className="border-b border-transparent font-medium text-[#191919] transition-colors hover:border-primary hover:text-primary dark:text-brand-500"
          >
            {seed.sellerName}
          </Link>
          <span className="ml-1 text-sm text-on-surface-variant">· Verified seller</span>
        </p>
        <Link
          href={seed.sellerHref}
          className="inline-flex w-fit items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary"
        >
          View portfolio
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      {children}
    </div>
  );
}

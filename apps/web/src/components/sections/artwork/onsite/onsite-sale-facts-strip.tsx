import type { SaleOverviewVM } from "@/components/sections/saleroom/view-models";
import Link from "next/link";

type Props = {
  overview: SaleOverviewVM;
  saleTermsHref?: string | null;
  className?: string;
};

/** Compact buyer's premium + format strip for onsite lot pages. */
export function OnsiteSaleFactsStrip({ overview, saleTermsHref, className }: Props) {
  return (
    <div
      className={`rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4 dark:bg-surface-container-low/40 ${className ?? ""}`}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
            Buyer&apos;s premium
          </dt>
          <dd className="mt-1 text-sm font-medium text-on-surface">{overview.buyerPremiumLabel}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
            Format
          </dt>
          <dd className="mt-1 text-sm font-medium text-on-surface">{overview.formatLabel}</dd>
        </div>
      </dl>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-label text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
        <Link href="/faq" className="text-on-surface underline-offset-4 hover:underline">
          How to bid
        </Link>
        {saleTermsHref ? (
          <Link href={saleTermsHref} className="text-on-surface underline-offset-4 hover:underline">
            Sale terms
          </Link>
        ) : (
          <Link href="/shipping" className="text-on-surface underline-offset-4 hover:underline">
            Shipping
          </Link>
        )}
      </p>
    </div>
  );
}

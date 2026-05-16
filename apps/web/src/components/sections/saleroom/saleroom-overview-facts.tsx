import Link from "next/link";
import type { SaleOverviewVM } from "./view-models";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-sm uppercase leading-4 text-on-surface-variant">{label}</dt>
      <dd className="text-base leading-6 text-on-surface">{value}</dd>
    </div>
  );
}

type Props = {
  overview: SaleOverviewVM;
};

/** Starts / ends / format / premium / lots + quick policy links. */
export function SaleroomOverviewFacts({ overview }: Props) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40">
      <h2 className="mb-4 text-xl font-semibold text-on-surface">Sale overview</h2>
      <dl className="grid grid-cols-1 gap-0">
        <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
          <Fact label="Starts" value={overview.startLabel} />
        </div>
        <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
          <Fact label="Ends" value={overview.endLabel} />
        </div>
        {overview.previewLabel ? (
          <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
            <Fact label="Preview" value={overview.previewLabel} />
          </div>
        ) : null}
        <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
          <Fact label="Format" value={overview.formatLabel} />
        </div>
        <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
          <Fact label="Buyer's premium" value={overview.buyerPremiumLabel} />
        </div>
        {overview.categoryLabel ? (
          <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
            <Fact label="Category" value={overview.categoryLabel} />
          </div>
        ) : null}
        <div className="flex justify-between gap-6 py-3">
          <Fact label="Lots" value={overview.lotsLabel} />
        </div>
      </dl>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-label text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
        <Link href="/faq" className="text-on-surface underline-offset-4 hover:underline">
          How to bid
        </Link>
        <Link href="/shipping" className="text-on-surface underline-offset-4 hover:underline">
          Shipping
        </Link>
      </p>
    </div>
  );
}

import {
  BUYER_PREMIUM_CONDITIONS_HREF,
  CONDITIONS_OF_SALE_LABEL,
} from "@/lib/lot/buyer-premium-copy";
import { LabelCaps } from "@auction/ui/components/typography";
import Link from "next/link";
import type { SaleOverviewVM } from "./view-models";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-b border-outline-variant/25 py-3">
      <dt>
        <LabelCaps className="text-on-surface-variant">{label}</LabelCaps>
      </dt>
      <dd className="text-base leading-6 text-on-surface">{value}</dd>
    </div>
  );
}

type Props = {
  overview: SaleOverviewVM;
};

function endFactLabelForStatus(status: SaleOverviewVM["status"]): string {
  switch (status) {
    case "ended":
      return "Ended";
    case "cancelled":
      return "Cancelled";
    case "voided":
      return "Voided";
    case "active":
      return "Ends";
    default:
      return "Ends";
  }
}

/** Starts / ends / format / premium in words + quick policy links (the Conditions set the premium). */
export function SaleroomOverviewFacts({ overview }: Props) {
  const showStarts = overview.status === "scheduled";
  const endFactLabel = endFactLabelForStatus(overview.status);

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40">
      <h2 className="mb-4 font-headline text-[length:var(--text-title-section)] font-semibold text-on-surface">
        Sale overview
      </h2>
      <dl className="grid grid-cols-1 gap-0">
        {showStarts ? <Fact label="Starts" value={overview.startLabel} /> : null}
        <Fact label={endFactLabel} value={overview.endLabel} />
        {overview.previewLabel ? <Fact label="Preview" value={overview.previewLabel} /> : null}
        <Fact label="Format" value={overview.formatLabel} />
        <Fact label="Buyer's premium" value={overview.buyerPremiumLabel} />
      </dl>
      {overview.categoryLabels.length > 0 ? (
        <div className="border-b border-outline-variant/25 py-3">
          <LabelCaps className="mb-2 text-on-surface-variant">Categories</LabelCaps>
          <ul className="flex list-none flex-wrap gap-2 p-0">
            {overview.categoryLabels.map((label) => (
              <li
                key={label}
                className="inline-flex items-center rounded border border-outline-variant/40 px-2.5 py-1 text-xs font-medium text-on-surface"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : overview.categoryLabel ? (
        <dl>
          <Fact label="Category" value={overview.categoryLabel} />
        </dl>
      ) : null}
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-label text-xs font-medium text-on-surface-variant">
        <Link href="/faq" className="text-on-surface underline-offset-4 hover:underline">
          How to bid
        </Link>
        <Link href="/shipping" className="text-on-surface underline-offset-4 hover:underline">
          Shipping
        </Link>
        <Link
          href={BUYER_PREMIUM_CONDITIONS_HREF}
          className="text-on-surface underline-offset-4 hover:underline"
        >
          {CONDITIONS_OF_SALE_LABEL}
        </Link>
      </p>
    </div>
  );
}

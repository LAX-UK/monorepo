import { LabelCaps } from "@auction/ui";
import Link from "next/link";
import { formatBuyerPremiumTierLabel } from "./mappers";
import type { SaleOverviewVM } from "./view-models";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
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

/** Starts / ends / format / premium + quick policy links. */
export function SaleroomOverviewFacts({ overview }: Props) {
  const tiers = overview.buyerPremiumTiers ?? [];
  const showStarts = overview.status === "scheduled";
  const endFactLabel = endFactLabelForStatus(overview.status);

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40">
      <h2 className="mb-4 font-headline text-[length:var(--text-title-section)] font-semibold text-on-surface">
        Sale overview
      </h2>
      <dl className="grid grid-cols-1 gap-0">
        {showStarts ? (
          <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
            <Fact label="Starts" value={overview.startLabel} />
          </div>
        ) : null}
        <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
          <Fact label={endFactLabel} value={overview.endLabel} />
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
        {tiers.length > 0 ? (
          <div className="border-b border-outline-variant/25 py-3">
            <LabelCaps className="mb-2 text-on-surface-variant">Premium tiers</LabelCaps>
            <table className="w-full text-sm text-on-surface">
              <tbody>
                {tiers.map((tier) => (
                  <tr
                    key={`${tier.hammerThresholdMinor}-${tier.rate}`}
                    className="border-t border-outline-variant/15 first:border-t-0"
                  >
                    <td className="py-2 pr-4">{formatBuyerPremiumTierLabel(tier)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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
          <div className="flex justify-between gap-6 border-b border-outline-variant/25 py-3">
            <Fact label="Category" value={overview.categoryLabel} />
          </div>
        ) : null}
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

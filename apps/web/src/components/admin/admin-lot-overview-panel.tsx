import {
  CatalogDetailSection,
  CatalogDetailSummaryStrip,
  CatalogExternalLink,
  CatalogInfoCard,
} from "@/components/admin/catalog";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { MediaImage } from "@/components/ui/media-image";
import { buildLotSummaryItems } from "@/lib/admin/build-lot-summary-items";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import { Badge } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  lotId: string;
  auction: Lot;
  imageAlts: string[];
  context: LotDetailContext;
  bidCount: number | null;
};

export function AdminLotOverviewPanel({ lotId, auction, imageAlts, context, bidCount }: Props) {
  const premiumPct = Number.parseFloat(auction.buyerPremiumRate);
  const premiumLabel = Number.isNaN(premiumPct)
    ? auction.buyerPremiumRate
    : formatPercent(premiumPct * 100);

  const summaryItems = buildLotSummaryItems(lotId, auction, bidCount);
  const marketing = auction.marketingDetails;

  return (
    <div className="space-y-8">
      <CatalogDetailSummaryStrip items={summaryItems} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <CatalogDetailSection
          title="Primary image"
          description="Hero image shown on the public lot page and in catalog listings."
        >
          {auction.images[0] ? (
            <div className="overflow-hidden rounded-xl border border-border-hairline bg-surface-container-low/40">
              <div className="relative aspect-[4/5] max-h-[min(480px,65vh)] w-full bg-surface-container-low">
                <MediaImage
                  src={auction.images[0]}
                  alt={imageAlts[0] ?? auction.title}
                  label="Primary lot image"
                  imgClassName="object-contain"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-hairline px-4 py-3">
                <span className="font-body text-sm text-on-surface-variant">
                  {auction.images.length} image{auction.images.length === 1 ? "" : "s"}
                </span>
                <Link
                  href={lotDetailTabHref(lotId, "images")}
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
                >
                  Manage images →
                </Link>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-outline-variant/40 p-6 text-sm text-on-surface-variant">
              No images yet.{" "}
              <Link
                href={lotDetailTabHref(lotId, "images")}
                className="font-medium text-link hover:underline"
              >
                Add images →
              </Link>
            </p>
          )}
        </CatalogDetailSection>

        <div className="space-y-4">
          <CatalogInfoCard title="Commercial">
            <dl className="space-y-3 font-body text-sm">
              <DetailRow label="Starting price" value={formatMoney(auction.startingPrice)} />
              <DetailRow
                label="Reserve"
                value={auction.reservePrice ? formatMoney(auction.reservePrice) : "No reserve"}
              />
              <DetailRow label="Current hammer" value={formatMoney(auction.currentPrice)} strong />
              <DetailRow label="Buyer premium" value={premiumLabel} />
              {auction.checkoutPricing ? (
                <DetailRow
                  label="Checkout total"
                  value={formatMoney(auction.checkoutPricing.totalMajor)}
                  hint={`Hammer ${formatMoney(auction.checkoutPricing.hammerMajor)} + premium ${formatMoney(auction.checkoutPricing.premiumMajor)}`}
                />
              ) : null}
              <DetailRow
                label="Auction type"
                value={<span className="capitalize">{auction.auctionType.replace(/_/g, " ")}</span>}
              />
            </dl>
          </CatalogInfoCard>
          <CatalogInfoCard title="Schedule">
            <dl className="space-y-3 font-body text-sm">
              <DetailRow label="Start" value={formatDateTime(auction.startTime)} tabular />
              <DetailRow label="End" value={formatDateTime(auction.endTime)} tabular />
            </dl>
            <p className="mt-3 text-xs text-on-surface-variant">
              Displayed in your browser locale. Cross-check published catalog copy for the canonical
              timezone.
            </p>
          </CatalogInfoCard>
        </div>
      </div>

      <CatalogDetailSection
        title="Catalogue"
        description="Full description and physical details shown to bidders."
      >
        <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
          {auction.description ? (
            <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-on-surface">
              {auction.description}
            </p>
          ) : (
            <p className="rounded-md border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
              No catalogue description yet.
            </p>
          )}
          {(auction.medium || auction.dimensions) && (
            <dl className="mt-4 space-y-2 border-t border-border-hairline pt-4 font-body text-sm">
              {auction.medium ? <DetailRow label="Medium" value={auction.medium} /> : null}
              {auction.dimensions ? (
                <DetailRow label="Dimensions" value={auction.dimensions} />
              ) : null}
            </dl>
          )}
          {context.categories.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-hairline pt-4">
              {context.categories.map((cat) => (
                <Link key={cat.id} href={`/admin/categories/${cat.id}`}>
                  <Badge variant="secondary">{cat.name}</Badge>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </CatalogDetailSection>

      {marketing.estimate ? (
        <CatalogDetailSection title="Estimates" description="Pre-sale estimate range for bidders.">
          <p className="font-body text-sm tabular-nums text-on-surface">
            {formatMoney(marketing.estimate.low)} – {formatMoney(marketing.estimate.high)}{" "}
            <span className="text-on-surface-variant">{marketing.estimate.currency}</span>
          </p>
        </CatalogDetailSection>
      ) : null}

      {marketing.conditionReport?.summary || marketing.conditionReport?.details ? (
        <CatalogDetailSection
          title="Condition"
          description="Condition report summary from marketing details."
        >
          <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
            {marketing.conditionReport.summary ? (
              <p className="font-body text-sm text-on-surface">
                {marketing.conditionReport.summary}
              </p>
            ) : null}
            {marketing.conditionReport.details ? (
              <p className="mt-2 whitespace-pre-wrap font-body text-sm text-on-surface-variant">
                {marketing.conditionReport.details}
              </p>
            ) : null}
            {marketing.conditionReport.downloadUrl ? (
              <p className="mt-3">
                <CatalogExternalLink
                  href={marketing.conditionReport.downloadUrl}
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                >
                  Download report
                </CatalogExternalLink>
              </p>
            ) : null}
          </div>
        </CatalogDetailSection>
      ) : null}

      {marketing.provenance && marketing.provenance.length > 0 ? (
        <CatalogDetailSection title="Provenance" description="Ownership and history notes.">
          <ul className="space-y-2 font-body text-sm text-on-surface">
            {marketing.provenance.map((entry, i) => (
              <li key={`${i}-${entry.note.slice(0, 24)}`}>
                {entry.period ? (
                  <span className="font-medium text-on-surface-variant">{entry.period}: </span>
                ) : null}
                {entry.note}
              </li>
            ))}
          </ul>
        </CatalogDetailSection>
      ) : null}

      {marketing.exhibitions && marketing.exhibitions.length > 0 ? (
        <CatalogDetailSection title="Exhibitions" description="Exhibition history.">
          <ul className="space-y-2 font-body text-sm text-on-surface">
            {marketing.exhibitions.map((entry, i) => (
              <li key={`${i}-${entry.venue}`}>
                {entry.year ? (
                  <span className="font-medium tabular-nums text-on-surface-variant">
                    {entry.year}{" "}
                  </span>
                ) : null}
                {entry.venue}
                {entry.note ? (
                  <span className="text-on-surface-variant"> — {entry.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </CatalogDetailSection>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  hint,
  strong,
  tabular,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  strong?: boolean;
  tabular?: boolean;
}) {
  return (
    <div>
      <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        {label}
      </dt>
      <dd
        className={
          strong
            ? "mt-0.5 text-base font-semibold tabular-nums text-on-surface"
            : tabular
              ? "mt-0.5 tabular-nums text-on-surface"
              : "mt-0.5 text-on-surface"
        }
      >
        {value}
      </dd>
      {hint ? <p className="mt-0.5 text-xs text-on-surface-variant">{hint}</p> : null}
    </div>
  );
}

import { CatalogInfoCard } from "@/components/admin/catalog";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { SplitDetailLayout } from "@/components/dashboard/primitives/split-detail-layout";
import { MediaImage } from "@/components/ui/media-image";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import { Badge } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  lotId: string;
  auction: Lot;
  imageAlts: string[];
  context: LotDetailContext;
};

export function AdminLotOverviewPanel({ lotId, auction, imageAlts, context }: Props) {
  const premiumPct = Number.parseFloat(auction.buyerPremiumRate);
  const premiumLabel = Number.isNaN(premiumPct)
    ? auction.buyerPremiumRate
    : formatPercent(premiumPct * 100);

  return (
    <SplitDetailLayout
      mediaSlot={
        auction.images[0] ? (
          <Surface variant="section" padding="none" className="overflow-hidden">
            <div className="relative aspect-[4/5] max-h-[min(520px,70vh)] w-full bg-surface-container-low lg:aspect-[3/4]">
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
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
              >
                Manage images →
              </Link>
            </div>
          </Surface>
        ) : (
          <Surface
            variant="quiet"
            padding="md"
            className="space-y-2 text-sm text-on-surface-variant"
          >
            <p>No images yet.</p>
            <Link
              href={lotDetailTabHref(lotId, "images")}
              className="font-medium text-primary hover:underline"
            >
              Add images in the Images tab →
            </Link>
          </Surface>
        )
      }
      metaSlot={
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
                value={<span className="capitalize">{auction.auctionType}</span>}
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
      }
      secondarySlot={
        <div className="space-y-4">
          <CatalogInfoCard title="Catalogue">
            {auction.description ? (
              <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-on-surface">
                {auction.description}
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant">No description.</p>
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
          </CatalogInfoCard>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CatalogInfoCard title="Sale">
              {context.sale ? (
                <div className="space-y-1">
                  <Link
                    href={`/admin/sales/${context.sale.id}/lots`}
                    className="font-medium text-primary hover:underline"
                  >
                    {context.sale.title}
                  </Link>
                  {auction.lotNumber != null ? (
                    <p className="text-xs text-on-surface-variant">Lot #{auction.lotNumber}</p>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-on-surface-variant">Not assigned to a sale</span>
              )}
            </CatalogInfoCard>
            <CatalogInfoCard title="Artist">
              {context.artist ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/artists/${context.artist.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {context.artist.displayName}
                  </Link>
                  {auction.artistReviewRequired ? (
                    <Badge variant="outline" className="border-warning/40 text-warning">
                      Review required
                    </Badge>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-on-surface-variant">Not assigned</span>
              )}
            </CatalogInfoCard>
            <CatalogInfoCard title="Seller">
              {context.seller ? (
                <div className="space-y-1">
                  <Link
                    href={`/admin/legal-entities/${context.seller.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {context.seller.displayName}
                  </Link>
                  {auction.archivedSeller ? (
                    <p className="text-xs text-warning">Seller entity archived</p>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-on-surface-variant">Not set</span>
              )}
            </CatalogInfoCard>
          </div>
        </div>
      }
    />
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

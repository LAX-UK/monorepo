import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SplitDetailLayout } from "@/components/dashboard/primitives/split-detail-layout";
import { MediaImage } from "@/components/ui/media-image";
import { formatDateTime } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  auction: Lot;
  imageAlts: string[];
};

export function AdminLotOverviewPanel({ auction, imageAlts }: Props) {
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
          </Surface>
        ) : (
          <Surface variant="quiet" padding="md" className="text-sm text-on-surface-variant">
            No images yet. Add images in the Images tab.
          </Surface>
        )
      }
      metaSlot={
        <div className="space-y-3">
          <InfoCard title="Status">
            <AdminStatusBadge domain="lot" status={auction.status} />
          </InfoCard>
          {auction.saleId ? (
            <InfoCard title="Sale">
              <Link
                href={`/admin/sales/${auction.saleId}`}
                className="font-medium text-primary hover:underline"
              >
                View sale ↗
              </Link>
              {auction.lotNumber ? (
                <span className="ml-2 font-body text-xs text-on-surface-variant">
                  Lot #{auction.lotNumber}
                </span>
              ) : null}
            </InfoCard>
          ) : (
            <InfoCard title="Sale">
              <span className="text-on-surface-variant">Not assigned to a sale</span>
            </InfoCard>
          )}
          <InfoCard title="Starting price">
            <span className="tabular-nums">{auction.startingPrice}</span>
            {auction.reservePrice ? (
              <span className="ml-2 text-xs text-on-surface-variant">
                Reserve: {auction.reservePrice}
              </span>
            ) : null}
          </InfoCard>
          <InfoCard title="Current hammer">
            <span key={auction.currentPrice} className="tick-value tabular-nums font-semibold">
              {auction.currentPrice}
            </span>
          </InfoCard>
          <InfoCard title="Schedule">
            <div className="space-y-0.5 font-body text-sm">
              <p>
                <span className="text-on-surface-variant">Start:</span>{" "}
                {formatDateTime(auction.startTime)}
              </p>
              <p>
                <span className="text-on-surface-variant">End:</span>{" "}
                {formatDateTime(auction.endTime)}
              </p>
            </div>
          </InfoCard>
          <InfoCard title="Artist">
            {auction.artistId ? (
              <Link
                href={`/admin/artists/${auction.artistId}`}
                className="font-medium text-primary hover:underline"
              >
                View artist ↗
              </Link>
            ) : (
              <span className="text-on-surface-variant">Not assigned</span>
            )}
            {auction.artistReviewRequired ? (
              <span className="ml-2 rounded bg-warning/10 px-1.5 py-0.5 font-label text-[10px] uppercase tracking-wider text-warning">
                Review required
              </span>
            ) : null}
          </InfoCard>
        </div>
      }
      secondarySlot={
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard title="Seller legal entity">
            {auction.sellerLegalEntityId ? (
              <Link
                href={`/admin/legal-entities/${auction.sellerLegalEntityId}`}
                className="font-mono text-sm text-primary hover:underline"
              >
                {auction.sellerLegalEntityId.slice(0, 8)}…
              </Link>
            ) : (
              <span className="text-on-surface-variant">Not set</span>
            )}
          </InfoCard>
          <InfoCard title="Auction type">
            <span className="capitalize">{auction.auctionType}</span>
          </InfoCard>
          {(auction.categoryIds?.length ?? 0) > 0 ? (
            <InfoCard title="Categories">
              <div className="flex flex-wrap gap-1">
                {(auction.categoryIds ?? []).map((cid) => (
                  <span
                    key={cid}
                    className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-xs text-on-surface-variant"
                  >
                    {cid.slice(0, 8)}…
                  </span>
                ))}
              </div>
            </InfoCard>
          ) : null}
          {auction.medium || auction.dimensions ? (
            <InfoCard title="Physical details">
              {auction.medium ? <p className="text-sm">{auction.medium}</p> : null}
              {auction.dimensions ? (
                <p className="text-xs text-on-surface-variant">{auction.dimensions}</p>
              ) : null}
            </InfoCard>
          ) : null}
        </div>
      }
    />
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Surface variant="card" className="border-border-hairline bg-surface-container-low/30">
      <h3 className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {title}
      </h3>
      <div className="pb-4">{children}</div>
    </Surface>
  );
}

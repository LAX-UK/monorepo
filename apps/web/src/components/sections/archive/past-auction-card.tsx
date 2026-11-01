import { OwnerBadge } from "@/components/marketing/owner-badge";
import { DomainStatusBadge } from "@/components/ui/domain-status-badge";
import { MediaImage } from "@/components/ui/media-image.server";
import { archiveLotResult } from "@/lib/archive/archive-lot-result";
import { formatLondonMonthYear } from "@/lib/datetime/london-time";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

function closingCaption(endTime: Date): string {
  return formatLondonMonthYear(endTime, { short: true });
}

type Props = {
  auction: Lot;
  sellerName: string;
  href: string;
  gridOffsetClass?: string;
  isOwner?: boolean;
};

export function PastAuctionCard({
  auction,
  sellerName,
  href,
  gridOffsetClass = "",
  isOwner = false,
}: Props) {
  const img = auction.images[0];
  const result = archiveLotResult(auction);
  const caption = [result.lotNumberLabel, closingCaption(auction.endTime)]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={`group ${gridOffsetClass}`}>
      <Link href={href} prefetch={false} className={cn("block rounded-sm", FOCUS_RING)}>
        <div className="relative mb-4 aspect-[4/5] overflow-hidden bg-surface-container-low md:mb-8">
          <MediaImage
            src={img}
            alt={`${auction.title} — past auction lot`}
            label="Lot artwork"
            imgClassName="transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
        <div className="flex items-start justify-between gap-2 md:gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <DomainStatusBadge
                domain="lot"
                status={auction.status}
                context={{ lot: result.statusContext }}
                size="sm"
              />
              <span className="font-label text-[0.55rem] text-on-surface-variant md:text-xs">
                {caption}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <h3 className="font-headline line-clamp-2 text-base tracking-tight text-on-surface transition-colors group-hover:text-link md:text-2xl">
                {auction.title}
              </h3>
              <OwnerBadge owned={isOwner} />
            </div>
            <p className="hidden text-sm font-normal text-on-surface-variant md:block">
              {sellerName}
            </p>
          </div>
          {result.hammer ? (
            <div className="shrink-0 text-right">
              <span className="mb-0.5 block font-label text-[0.55rem] text-on-surface-variant md:mb-1 md:text-xs">
                {result.hammer.label}
              </span>
              <span className="font-headline text-base tabular-nums text-on-surface md:text-xl">
                {result.hammer.value}
              </span>
            </div>
          ) : null}
        </div>
      </Link>
    </div>
  );
}

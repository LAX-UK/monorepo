import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MediaImage } from "@/components/ui/media-image";
import { formatMoney } from "@/lib/format-currency";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

function lotNo(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function closingCaption(endTime: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(endTime);
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
  return (
    <div className={`group ${gridOffsetClass}`}>
      <Link href={href} className={cn("block rounded-sm", FOCUS_RING)}>
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
            <span className="block font-label text-[0.55rem] uppercase tracking-[0.15em] text-on-surface-variant md:text-[0.625rem] md:tracking-[0.2em]">
              Lot No. {lotNo(auction.id)} · {closingCaption(auction.endTime)}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <h3 className="font-headline line-clamp-2 text-base tracking-tight text-on-surface transition-colors group-hover:text-link md:text-2xl">
                {auction.title}
              </h3>
              <OwnerBadge owned={isOwner} />
            </div>
            <p className="hidden text-sm font-light text-on-surface-variant md:block">
              {sellerName}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="mb-0.5 block font-label text-[0.55rem] uppercase tracking-[0.15em] text-on-surface-variant md:mb-1 md:text-[0.625rem] md:tracking-[0.2em]">
              Hammer price
            </span>
            <span className="font-headline text-base tabular-nums text-on-surface md:text-xl">
              {formatMoney(auction.currentPrice)}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

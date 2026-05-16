import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MediaImage } from "@/components/ui/media-image";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";
import Link from "next/link";

function closingSeason(endTime: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(endTime);
}

export type ArchiveLotHeroRow = {
  auction: Lot;
  sellerName: string;
};

type Props = {
  row: ArchiveLotHeroRow;
  isOwner?: boolean;
};

/** Editorial single-column card — distinct from staggered grid `PastAuctionCard`. */
export function ArchiveLotCardHero({ row, isOwner = false }: Props) {
  const a = row.auction;
  const img = a.images[0];
  const chip =
    a.status === "ended"
      ? `Ended · ${closingSeason(a.endTime)}`
      : `${a.status.replace(/_/g, " ")} · ${closingSeason(a.endTime)}`;

  return (
    <article className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md">
      <Link
        href={lotPath(a)}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-container-low">
          <MediaImage
            src={img}
            alt={`${a.title} — past auction`}
            label="Lot artwork"
            className="absolute inset-0 size-full"
            imgClassName="size-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
            sizes="(max-width: 768px) 100vw, 42rem"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0 flex-1">
              <span className="mb-2 inline-block rounded-full border border-white/20 bg-black/35 px-2.5 py-0.5 font-label text-[0.65rem] font-semibold uppercase tracking-widest text-white/95 backdrop-blur-sm">
                {chip}
              </span>
              <h3 className="font-headline text-2xl font-light leading-tight tracking-tight text-white drop-shadow-sm sm:text-3xl">
                {a.title}
              </h3>
            </div>
            <OwnerBadge
              owned={isOwner}
              className="shrink-0 border border-white/25 bg-black/30 text-white backdrop-blur-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 border-t border-outline-variant/10 p-5 sm:p-6">
          <div className="min-w-0 space-y-1">
            {a.medium ? (
              <p className="line-clamp-2 font-body text-sm text-on-surface-variant">{a.medium}</p>
            ) : null}
            <p className="font-body text-sm text-on-surface-variant">{row.sellerName}</p>
          </div>
          <div className="text-right">
            <p className="mb-1 font-label text-[0.65rem] font-semibold uppercase tracking-widest text-on-surface-variant">
              Hammer
            </p>
            <p className="font-headline text-2xl tabular-nums text-on-surface">
              {formatMoney(a.currentPrice)}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}

import { ArchiveLotCardHero } from "@/components/sections/archive/archive-lot-card-hero";
import { PastAuctionCard } from "@/components/sections/archive/past-auction-card";
import { MediaImage } from "@/components/ui/media-image";
import { RevealInView } from "@/components/ui/reveal";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

export type ArchiveLotVM = {
  auction: Lot;
  sellerName: string;
};

/** Calmer stagger than legacy grid (plan: ~50% reduction). */
const OFFSET_PATTERN = ["", "lg:mt-8", "", "md:-mt-4", "lg:mt-12", ""] as const;

export function ArchiveLotGridView({
  items,
  currentUserId = null,
}: {
  items: ArchiveLotVM[];
  currentUserId?: string | null;
}) {
  return (
    <section
      className={cn(
        "mx-auto max-w-screen-2xl gap-x-4 gap-y-8 md:gap-x-12 md:gap-y-16",
        sparseGridClasses(items.length, {
          multi:
            "grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-2 md:gap-x-12 md:gap-y-16 lg:grid-cols-3",
        }),
      )}
    >
      {items.map((row, i) => (
        <RevealInView key={row.auction.id} variant="fadeUp" delayMs={i * 70} className="min-w-0">
          <PastAuctionCard
            auction={row.auction}
            sellerName={row.sellerName}
            gridOffsetClass={OFFSET_PATTERN[i % OFFSET_PATTERN.length] ?? ""}
            isOwner={Boolean(currentUserId && row.auction.sellerId === currentUserId)}
          />
        </RevealInView>
      ))}
    </section>
  );
}

export function ArchiveLotCardView({
  items,
  currentUserId = null,
}: {
  items: ArchiveLotVM[];
  currentUserId?: string | null;
}) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-12">
      {items.map((row, i) => (
        <RevealInView
          key={row.auction.id}
          variant="fadeUp"
          delayMs={i * 70}
          className="block w-full"
        >
          <ArchiveLotCardHero
            row={row}
            isOwner={Boolean(currentUserId && row.auction.sellerId === currentUserId)}
          />
        </RevealInView>
      ))}
    </section>
  );
}

export function ArchiveLotListView({
  items,
  currentUserId: _currentUserId = null,
}: {
  items: ArchiveLotVM[];
  currentUserId?: string | null;
}) {
  return (
    <div className="-mx-4 max-w-none border-y border-border-hairline bg-surface-container-lowest sm:mx-auto sm:max-w-screen-2xl sm:rounded-xl sm:border sm:border-border-hairline">
      <ul className="divide-y divide-outline-variant/15 sm:rounded-xl">
        {items.map((row, i) => {
          const a = row.auction;
          const img = a.images[0];
          return (
            <li key={a.id}>
              <RevealInView variant="fadeUp" delayMs={i * 50} className="block w-full">
                <Link
                  href={lotPath(a)}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-container-low/40 sm:px-6 sm:py-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-container-low">
                      <MediaImage
                        src={img}
                        alt=""
                        label="Lot artwork"
                        className="size-full"
                        imgClassName="object-cover"
                        sizes="64px"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="font-headline text-base text-on-surface sm:text-lg">
                        {a.title}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">{row.sellerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                      Hammer
                    </p>
                    <p className="font-headline text-lg tabular-nums text-on-surface">
                      {formatMoney(a.currentPrice)}
                    </p>
                  </div>
                </Link>
              </RevealInView>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

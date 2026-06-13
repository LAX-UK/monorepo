import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { ArchiveLotCardHero } from "@/components/sections/archive/archive-lot-card-hero";
import { PastAuctionCard } from "@/components/sections/archive/past-auction-card";
import { MediaImage } from "@/components/ui/media-image";
import { formatMoney } from "@/lib/format-currency";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import {
  FOCUS_RING,
  MARKETING_CATALOG_LIST_SHELL,
  MARKETING_PAGE_INNER,
} from "@/lib/marketing/chrome";
import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

export type ArchiveLotVM = {
  auction: Lot;
  sellerName: string;
};

type ArchiveLinkProps = {
  catalogLinkParams?: CatalogLinkParams;
};

function resolveArchiveLotHref(lot: Lot, catalogLinkParams?: CatalogLinkParams): string {
  return lotCatalogHref(lot, catalogLinkParams);
}

/** Calmer stagger than legacy grid (plan: ~50% reduction). */
const OFFSET_PATTERN = ["", "lg:mt-8", "", "md:-mt-4", "lg:mt-12", ""] as const;

export function ArchiveLotGridView({
  items,
  currentUserId = null,
  catalogLinkParams,
}: {
  items: ArchiveLotVM[];
  currentUserId?: string | null;
} & ArchiveLinkProps) {
  return (
    <section
      className={cn(
        MARKETING_PAGE_INNER,
        "gap-x-4 gap-y-8 md:gap-x-12 md:gap-y-16",
        sparseGridClasses(items.length, {
          multi:
            "grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-2 md:gap-x-12 md:gap-y-16 lg:grid-cols-3",
        }),
      )}
    >
      {items.map((row, i) => (
        <MarketingCardReveal key={row.auction.id} index={i} className="min-w-0">
          <PastAuctionCard
            auction={row.auction}
            sellerName={row.sellerName}
            href={resolveArchiveLotHref(row.auction, catalogLinkParams)}
            gridOffsetClass={OFFSET_PATTERN[i % OFFSET_PATTERN.length] ?? ""}
            isOwner={Boolean(currentUserId && row.auction.sellerId === currentUserId)}
          />
        </MarketingCardReveal>
      ))}
    </section>
  );
}

export function ArchiveLotCardView({
  items,
  currentUserId = null,
  catalogLinkParams,
}: {
  items: ArchiveLotVM[];
  currentUserId?: string | null;
} & ArchiveLinkProps) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-12">
      {items.map((row, i) => (
        <MarketingCardReveal key={row.auction.id} index={i} className="block w-full">
          <ArchiveLotCardHero
            row={row}
            href={resolveArchiveLotHref(row.auction, catalogLinkParams)}
            isOwner={Boolean(currentUserId && row.auction.sellerId === currentUserId)}
          />
        </MarketingCardReveal>
      ))}
    </section>
  );
}

export function ArchiveLotListView({
  items,
  currentUserId: _currentUserId = null,
  catalogLinkParams,
}: {
  items: ArchiveLotVM[];
  currentUserId?: string | null;
} & ArchiveLinkProps) {
  return (
    <div className={MARKETING_CATALOG_LIST_SHELL}>
      <ul className="divide-y divide-outline-variant/15 sm:rounded-xl">
        {items.map((row, i) => {
          const a = row.auction;
          const img = a.images[0];
          return (
            <li key={a.id}>
              <MarketingCardReveal index={i} className="block w-full">
                <Link
                  href={resolveArchiveLotHref(a, catalogLinkParams)}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-container-low/40 sm:px-6 sm:py-5",
                    FOCUS_RING,
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="relative size-20 shrink-0 overflow-hidden rounded-md bg-surface-container-low sm:size-24">
                      <MediaImage
                        src={img}
                        alt=""
                        label="Lot artwork"
                        className="size-full"
                        imgClassName="object-cover"
                        sizes="96px"
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
              </MarketingCardReveal>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

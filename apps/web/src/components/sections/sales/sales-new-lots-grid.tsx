import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MediaImage } from "@/components/ui/media-image";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import { lotStatusMarketingShortLabel } from "@/lib/marketing/lot-status-labels";
import type { Lot } from "@auction/types";
import Link from "next/link";

type Props = {
  lots: Lot[];
  catalogLinkParams?: CatalogLinkParams;
};

function resolveLotHref(lot: Lot, catalogLinkParams?: CatalogLinkParams): string {
  return lotCatalogHref(lot, catalogLinkParams);
}

/** New lots tab — recent catalog lots (`GET /lots` contract). */
export function SalesNewLotsGrid({ lots, catalogLinkParams }: Props) {
  if (lots.length === 0) {
    return (
      <MarketingEmptyState
        variant="marketing"
        context="noResults"
        title="No new lots yet"
        description="Check back soon for recently listed works."
      />
    );
  }

  return (
    <ul className="m-0 grid auto-rows-fr list-none grid-cols-1 items-stretch gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
      {lots.map((lot, index) => (
        <li key={lot.id} className="flex min-w-0 flex-col">
          <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest transition-shadow duration-200 motion-safe:hover:shadow-md dark:border-outline-variant/30 dark:bg-surface-container-low/40">
            <Link
              href={resolveLotHref(lot, catalogLinkParams)}
              className="relative aspect-[4/3] w-full overflow-hidden bg-surface-container dark:bg-surface-container-low"
            >
              <MediaImage
                src={lot.images[0] ?? null}
                alt={lot.title}
                label="Lot image"
                className="absolute inset-0 size-full"
                imgClassName="size-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                priority={index < 3}
              />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <LotStatusBadge
                  status={lot.status}
                  startTime={
                    lot.startTime instanceof Date ? lot.startTime.toISOString() : lot.startTime
                  }
                  endTime={lot.endTime instanceof Date ? lot.endTime.toISOString() : lot.endTime}
                  closingShort={lotStatusMarketingShortLabel(lot.status)}
                />
              </div>
              <Link
                href={resolveLotHref(lot, catalogLinkParams)}
                className="line-clamp-2 min-h-[2.5rem] font-body text-base font-semibold leading-snug text-on-surface underline-offset-2 hover:underline dark:text-on-surface"
              >
                {lot.title}
              </Link>
              {lot.medium ? (
                <p className="line-clamp-2 font-body text-sm text-on-surface-variant">
                  {lot.medium}
                </p>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

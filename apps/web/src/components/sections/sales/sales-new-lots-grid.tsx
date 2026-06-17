import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { MarketingCatalogGrid } from "@/components/marketing/marketing-catalog-grid";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MediaImage } from "@/components/ui/media-image";
import { lotCardTimingToTimerInputs } from "@/lib/lot/to-lot-timer-inputs";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { lotStatusMarketingShortLabel } from "@/lib/marketing/lot-status-labels";
import type { CatalogLotVM } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  lots: CatalogLotVM[];
  catalogLinkParams?: CatalogLinkParams;
};

function resolveLotHref(lot: CatalogLotVM, catalogLinkParams?: CatalogLinkParams): string {
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
    <MarketingCatalogGrid
      count={lots.length}
      gridClassName="m-0 gap-6"
      multi="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    >
      {lots.map((lot, index) => (
        <article
          key={lot.id}
          className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest transition-transform duration-[var(--motion-duration-md)] ease-out motion-safe:hover:-translate-y-px motion-reduce:transition-none hover:ring-1 hover:ring-primary/20 dark:border-outline-variant/30 dark:bg-surface-container-low/40"
        >
          <Link
            href={resolveLotHref(lot, catalogLinkParams)}
            className={cn(
              "relative aspect-[4/5] w-full overflow-hidden bg-surface-container dark:bg-surface-container-low",
              FOCUS_RING,
            )}
          >
            <MediaImage
              src={lot.images[0] ?? null}
              alt={lot.title}
              label="Lot image"
              className="absolute inset-0 size-full"
              imgClassName="size-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              priority={index < 3}
            />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <LotStatusBadge
                {...lotCardTimingToTimerInputs(lot)}
                closingShort={lotStatusMarketingShortLabel(lot.status)}
              />
            </div>
            <Link
              href={resolveLotHref(lot, catalogLinkParams)}
              className={cn(
                "line-clamp-2 min-h-[2.5rem] rounded-sm font-body text-base font-semibold leading-snug text-on-surface underline-offset-2 hover:underline dark:text-on-surface",
                FOCUS_RING,
              )}
            >
              {lot.title}
            </Link>
            {lot.medium ? (
              <p className="line-clamp-2 font-body text-sm text-on-surface-variant">{lot.medium}</p>
            ) : null}
          </div>
        </article>
      ))}
    </MarketingCatalogGrid>
  );
}

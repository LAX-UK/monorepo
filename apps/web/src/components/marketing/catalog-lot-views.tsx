import {
  LOT_CARD_STATUS_CORNER,
  LotCard,
  type LotCardLinkProps,
} from "@/components/lot-card/lot-card";
import { lotCardGridAction } from "@/components/lot-card/lot-card-action";
import { LotCardBidderState } from "@/components/lot-card/lot-card-bidder-state";
import { LotCardLine } from "@/components/lot-card/lot-card-line";
import { LotEstimateLine } from "@/components/lot-card/lot-estimate-line";
import { LotListRow } from "@/components/marketing/lot-list-row";
import { catalogLotCardExtras } from "@/components/marketing/lot-quick-look/catalog-lot-card-extras";
import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { LotViewTransitionLink } from "@/components/marketing/lot-view-transition-link";
import { MarketingCatalogGrid } from "@/components/marketing/marketing-catalog-grid";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { MediaImage } from "@/components/ui/media-image";
import { isPublicLotStatus } from "@/lib/catalog/public-catalog-visibility";
import { lotCardLineModel, lotCardShowsStatusBadge } from "@/lib/lot-card/lot-card-line";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import { MARKETING_CATALOG_LIST_SHELL } from "@/lib/marketing/chrome";
import { LOT_CARD_GRID_SLOTS } from "@/lib/media/overlay-slot-presets";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import { lotPath } from "@/lib/seo/url";
import type { OverlaySurface } from "@/lib/ui/overlay-tone-classes";
import { LOT_TRANSITION_IMAGE_ATTR, LOT_TRANSITION_ROOT_ATTR } from "@/lib/view-transitions";
import { type LotMediaTreatmentIndex, lotMediaTreatment } from "@auction/domain";
import { lotCardMediaFrame } from "@auction/marketing-ui/lot-media/lot-card-media-frame";
import type { CatalogLotVM } from "@auction/types";
import Link from "next/link";

export type CatalogLotViewsProps = {
  lots: CatalogLotVM[];
  currentUserId: string | null;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
  /** How each department shows its lots on a card; left out, every lot is a wall work. */
  treatments?: LotMediaTreatmentIndex;
  /** Optional query params to preserve catalogue context (e.g. `view=list`). */
  catalogLinkParams?: CatalogLinkParams;
};

function resolveLotHref(lot: CatalogLotVM, catalogLinkParams?: CatalogLinkParams): string {
  return catalogLinkParams ? lotCatalogHref(lot, catalogLinkParams) : lotPath(lot);
}

function lotSubtitle(lot: CatalogLotVM): string | null {
  return lot.medium?.trim() ? lot.medium.trim() : null;
}

function LotWatchlistHeart({
  lot,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
  layout = "overlay",
  surface,
}: {
  lot: CatalogLotVM;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
  layout?: "overlay" | "inline";
  surface?: OverlaySurface;
}) {
  return (
    <MarketingWatchlistHeart
      lotId={lot.id}
      lotTitle={lot.title}
      initialWatching={watchedLotIds.includes(lot.id)}
      isAuthenticated={isAuthenticated}
      loginNextPath={loginNextPath}
      layout={layout}
      {...(surface ? { surface } : {})}
    />
  );
}

function LotStatusOverlay({ lot }: { lot: CatalogLotVM }) {
  if (!isPublicLotStatus(lot.status)) return null;
  // The price line carries the clock; the badge stays only for outcomes the line does not say.
  if (!lotCardShowsStatusBadge(lotCardLineModel(lot, new Date()))) return null;
  return (
    <div className={LOT_CARD_STATUS_CORNER}>
      <LotStatusBadge {...lotStatusBadgeProps(lot)} />
    </div>
  );
}

/** The search link that names the lot's view transition (picture and title). */
function CatalogLotLink({ lotId, ...props }: LotCardLinkProps) {
  if (!lotId) return <Link {...props} />;
  return <LotViewTransitionLink lotId={lotId} {...props} />;
}

type CatalogLotCardProps = Omit<CatalogLotViewsProps, "lots" | "treatments"> & {
  lot: CatalogLotVM;
  treatments: LotMediaTreatmentIndex;
  sizes: string;
};

/** A search result as the one lot card (grid and card views). */
function CatalogLotCard({
  lot,
  currentUserId,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
  treatments,
  catalogLinkParams,
  sizes,
}: CatalogLotCardProps) {
  const href = resolveLotHref(lot, catalogLinkParams);
  const style = lotMediaTreatment(lot, treatments).style;
  const fit = lotCardMediaFrame(style).fit;
  const owned = Boolean(currentUserId && lot.sellerId === currentUserId);
  const extras = catalogLotCardExtras(lot, { isAuthenticated, watchedLotIds, loginNextPath });
  const status = <LotStatusOverlay lot={lot} />;
  return (
    <AdaptiveMediaFrame
      src={lot.images[0]}
      objectFit={fit}
      slots={LOT_CARD_GRID_SLOTS}
      className="flex h-full min-w-0 flex-col"
    >
      <LotCard
        href={href}
        lotId={lot.id}
        LinkComponent={CatalogLotLink}
        rootAttributes={{ [LOT_TRANSITION_ROOT_ATTR]: lot.id }}
        mediaAttributes={{ [LOT_TRANSITION_IMAGE_ATTR]: true }}
        title={lot.title}
        titleAs="h2"
        lotLabel={lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null}
        mediaStyle={style}
        MediaBox={AdaptiveMediaFrameContainer}
        media={
          <AdaptiveFrameImage
            src={lot.images[0]}
            alt={lot.title}
            objectFit={fit}
            sizes={sizes}
            label="Lot artwork"
          />
        }
        badge={owned ? <OwnerBadge owned /> : null}
        status={status}
        save={extras.save}
        quickLook={extras.quickLook}
        subtitle={lotSubtitle(lot)}
        meta={
          <>
            <LotEstimateLine value={lotEstimateLine(lot)} />
            <LotCardLine model={lotCardLineModel(lot, new Date())} />
            <LotCardBidderState lotId={lot.id} lotHref={href} lotTitle={lot.title} />
          </>
        }
        action={lotCardGridAction({ ...lot, href })}
      />
    </AdaptiveMediaFrame>
  );
}

export function CatalogLotGridView({ lots, treatments = {}, ...viewer }: CatalogLotViewsProps) {
  return (
    <MarketingCatalogGrid
      count={lots.length}
      gridClassName="gap-3 sm:gap-4 md:gap-8"
      multi="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3"
    >
      {lots.map((lot) => (
        <CatalogLotCard
          key={lot.id}
          lot={lot}
          treatments={treatments}
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw"
          {...viewer}
        />
      ))}
    </MarketingCatalogGrid>
  );
}

/**
 * The card view (`?view=card`): one large lot card per row, the same card as the grid (one frame,
 * nothing on the picture but the status pill, the heart on the "Lot N" line).
 */
export function CatalogLotCardView({ lots, treatments = {}, ...viewer }: CatalogLotViewsProps) {
  return (
    <ul className="mx-auto flex max-w-md flex-col gap-12">
      {lots.map((lot) => (
        <li key={lot.id}>
          <CatalogLotCard
            lot={lot}
            treatments={treatments}
            sizes="(max-width: 480px) 100vw, 28rem"
            {...viewer}
          />
        </li>
      ))}
    </ul>
  );
}

export function CatalogLotListView({
  lots,
  currentUserId,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
  catalogLinkParams,
}: CatalogLotViewsProps) {
  return (
    <div className={MARKETING_CATALOG_LIST_SHELL}>
      <ul className="divide-y divide-outline-variant/15 sm:rounded-xl">
        {lots.map((a) => {
          const img = a.images[0];
          const est = lotEstimateLine(a);
          const subtitle = lotSubtitle(a);
          return (
            <li key={a.id}>
              <LotListRow
                lotId={a.id}
                href={resolveLotHref(a, catalogLinkParams)}
                image={
                  <MediaImage
                    src={img}
                    alt=""
                    label="Lot artwork"
                    className="absolute inset-0 size-full"
                    imgClassName="object-cover"
                    sizes="96px"
                  />
                }
                title={
                  <div className="min-w-0">
                    <h2 className="font-headline text-base font-medium text-on-surface underline-offset-4 group-hover:underline sm:text-lg">
                      {a.title}
                    </h2>
                    {subtitle ? (
                      <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant sm:text-sm">
                        {subtitle}
                      </p>
                    ) : null}
                  </div>
                }
                trailing={
                  <div className="flex shrink-0 items-center gap-2">
                    <OwnerBadge
                      key="owner-badge"
                      owned={Boolean(currentUserId && a.sellerId === currentUserId)}
                    />
                    <LotWatchlistHeart
                      key="watchlist"
                      lot={a}
                      isAuthenticated={isAuthenticated}
                      watchedLotIds={watchedLotIds}
                      loginNextPath={loginNextPath}
                      layout="inline"
                      surface="inline"
                    />
                  </div>
                }
                footer={
                  <div className="flex w-full min-w-0 flex-col gap-1.5">
                    <LotEstimateLine value={est} />
                    <LotCardLine model={lotCardLineModel(a, new Date())} />
                    <LotCardBidderState
                      lotId={a.id}
                      lotHref={resolveLotHref(a, catalogLinkParams)}
                      lotTitle={a.title}
                    />
                  </div>
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

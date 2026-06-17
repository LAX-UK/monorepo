import { CatalogLotEditorialCalmCaption } from "@/components/marketing/catalog-lot-editorial-calm-caption";
import { LotCardEditorialCalm, LotCardGrid, LotCardList } from "@/components/marketing/lot-card";
import { CatalogLotQuickLookCorner } from "@/components/marketing/lot-quick-look/catalog-lot-quick-look-corner";
import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { MarketingCatalogGrid } from "@/components/marketing/marketing-catalog-grid";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { MediaImage } from "@/components/ui/media-image";
import { isPublicLotStatus } from "@/lib/catalog/public-catalog-visibility";
import { formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotCardTimingToTimerInputs } from "@/lib/lot/to-lot-timer-inputs";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import { MARKETING_CATALOG_LIST_SHELL } from "@/lib/marketing/chrome";
import { EDITORIAL_CALM_SLOTS, LOT_CARD_GRID_SLOTS } from "@/lib/media/overlay-slot-presets";
import { lotPath } from "@/lib/seo/url";
import type { OverlaySurface } from "@/lib/ui/overlay-tone-classes";
import type { CatalogLotVM } from "@auction/types";

export type CatalogLotViewsProps = {
  lots: CatalogLotVM[];
  currentUserId: string | null;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
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
  return <LotStatusBadge {...lotCardTimingToTimerInputs(lot)} />;
}

export function CatalogLotGridView({
  lots,
  currentUserId,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
  catalogLinkParams,
}: CatalogLotViewsProps) {
  return (
    <MarketingCatalogGrid
      count={lots.length}
      gridClassName="gap-3 sm:gap-4 md:gap-8"
      multi="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3"
    >
      {lots.map((a) => {
        const img = a.images[0];
        const est = lotEstimateLine(a);
        const subtitle = lotSubtitle(a);
        const owned = Boolean(currentUserId && a.sellerId === currentUserId);
        return (
          <LotCardGrid
            key={a.id}
            className="h-full"
            lotId={a.id}
            href={resolveLotHref(a, catalogLinkParams)}
            topLeft={owned ? <OwnerBadge owned className="pointer-events-auto" /> : null}
            imageOverlays={
              <CatalogLotQuickLookCorner
                lot={a}
                isAuthenticated={isAuthenticated}
                watchedLotIds={watchedLotIds}
                loginNextPath={loginNextPath}
                bottomLeftAddon={<LotStatusOverlay lot={a} />}
              />
            }
            adaptiveMedia={{
              src: img,
              objectFit: "contain",
              slots: LOT_CARD_GRID_SLOTS,
              alt: a.title,
              sizes: "(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw",
              label: "Lot artwork",
            }}
            title={
              <>
                <h2 className="font-headline line-clamp-2 text-sm font-light text-on-surface group-hover:text-link md:text-xl">
                  {a.title}
                </h2>
                <p className="mt-0.5 line-clamp-1 min-h-4 font-body text-xs text-on-surface-variant md:mt-1 md:text-sm">
                  {subtitle ?? "\u00a0"}
                </p>
              </>
            }
            meta={
              <>
                <p className="mt-1 font-label text-[length:var(--text-label-1)] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary md:mt-2 md:text-xs">
                  {formatMoney(a.currentPrice, resolveLotCurrency(a))}
                </p>
                <p className="mt-0.5 hidden min-h-4 font-label text-[length:var(--text-label-2)] uppercase tracking-wider text-on-surface-variant md:mt-1 md:block">
                  {est ? `Est. ${est}` : "\u00a0"}
                </p>
              </>
            }
          />
        );
      })}
    </MarketingCatalogGrid>
  );
}

export function CatalogLotCardView({
  lots,
  currentUserId,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
  catalogLinkParams,
}: CatalogLotViewsProps) {
  return (
    <ul className="mx-auto flex max-w-2xl flex-col gap-10">
      {lots.map((a) => {
        const img = a.images[0];
        const est = lotEstimateLine(a);
        const subtitle = lotSubtitle(a);
        const owned = Boolean(currentUserId && a.sellerId === currentUserId);
        return (
          <li key={a.id}>
            <LotCardEditorialCalm
              href={resolveLotHref(a, catalogLinkParams)}
              topRight={
                <div className="flex flex-col items-end gap-2">
                  {owned ? (
                    <OwnerBadge key="owner-badge" owned className="pointer-events-auto" />
                  ) : null}
                  <LotWatchlistHeart
                    key="watchlist"
                    lot={a}
                    isAuthenticated={isAuthenticated}
                    watchedLotIds={watchedLotIds}
                    loginNextPath={loginNextPath}
                    layout="inline"
                    surface="onImage"
                  />
                </div>
              }
              adaptiveMedia={{
                src: img,
                objectFit: "contain",
                slots: EDITORIAL_CALM_SLOTS,
                alt: a.title,
                sizes: "(max-width: 768px) 100vw, 42rem",
                label: "Lot artwork",
              }}
              title={
                <CatalogLotEditorialCalmCaption
                  lot={a}
                  title={a.title}
                  subtitle={subtitle}
                  estimate={est}
                />
              }
            />
          </li>
        );
      })}
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
              <LotCardList
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-label text-[length:var(--text-label-1)] uppercase tracking-wider text-secondary">
                        {formatMoney(a.currentPrice, resolveLotCurrency(a))}
                      </p>
                      {est ? (
                        <p className="mt-0.5 font-label text-[length:var(--text-label-2)] uppercase tracking-wider text-on-surface-variant">
                          Est. {est}
                        </p>
                      ) : null}
                    </div>
                    {isPublicLotStatus(a.status) ? (
                      <div className="tabular-nums">
                        <LotStatusBadge {...lotCardTimingToTimerInputs(a)} />
                      </div>
                    ) : null}
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

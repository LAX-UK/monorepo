import {
  LotCardEditorialCalm,
  LotCardGrid,
  LotCardList,
} from "@/components/marketing/lot-card";
import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { MediaImage } from "@/components/ui/media-image";
import { formatMoney } from "@/lib/format-currency";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { EDITORIAL_CALM_SLOTS, LOT_CARD_GRID_SLOTS } from "@/lib/media/overlay-slot-presets";
import { lotPath } from "@/lib/seo/url";
import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import type { Lot } from "@auction/types";
import { cn } from "@auction/ui";

export type CatalogLotViewsProps = {
  lots: Lot[];
  currentUserId: string | null;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
};

function lotSubtitle(lot: Lot): string | null {
  return lot.medium?.trim() ? lot.medium.trim() : null;
}

function LotWatchlistHeart({
  lot,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
  layout = "overlay",
}: {
  lot: Lot;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
  layout?: "overlay" | "inline";
}) {
  return (
    <MarketingWatchlistHeart
      lotId={lot.id}
      lotTitle={lot.title}
      initialWatching={watchedLotIds.includes(lot.id)}
      isAuthenticated={isAuthenticated}
      loginNextPath={loginNextPath}
      layout={layout}
    />
  );
}

function LotStatusOverlay({ lot }: { lot: Lot }) {
  if (lot.status === "draft") return null;
  return (
    <LotStatusBadge
      status={lot.status}
      startTime={lot.startTime.toISOString()}
      endTime={lot.endTime.toISOString()}
    />
  );
}

export function CatalogLotGridView({
  lots,
  currentUserId,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
}: CatalogLotViewsProps) {
  return (
    <ul
      className={cn(
        "gap-3 sm:gap-4 md:gap-8",
        sparseGridClasses(lots.length, {
          multi:
            "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3",
        }),
      )}
    >
      {lots.map((a) => {
        const img = a.images[0];
        const est = lotEstimateLine(a);
        const subtitle = lotSubtitle(a);
        const owned = Boolean(currentUserId && a.sellerId === currentUserId);
        return (
          <li key={a.id} className="min-w-0">
            <LotCardGrid
              lotId={a.id}
              href={lotPath(a)}
              topLeft={owned ? <OwnerBadge owned className="pointer-events-auto" /> : null}
              topRight={
                <LotWatchlistHeart
                  lot={a}
                  isAuthenticated={isAuthenticated}
                  watchedLotIds={watchedLotIds}
                  loginNextPath={loginNextPath}
                />
              }
              bottomLeft={<LotStatusOverlay lot={a} />}
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
                  <h2 className="font-headline line-clamp-2 text-sm font-light text-on-surface group-hover:text-primary md:text-xl">
                    {a.title}
                  </h2>
                  {subtitle ? (
                    <p className="mt-0.5 line-clamp-1 font-body text-xs text-on-surface-variant md:mt-1 md:text-sm">
                      {subtitle}
                    </p>
                  ) : null}
                </>
              }
              meta={
                <>
                  <p className="mt-1 font-label text-[length:var(--text-label-1)] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary md:mt-2 md:text-xs">
                    {formatMoney(a.currentPrice)}
                  </p>
                  {est ? (
                    <p className="mt-0.5 hidden font-label text-[length:var(--text-label-2)] uppercase tracking-wider text-on-surface-variant md:mt-1 md:block">
                      Est. {est}
                    </p>
                  ) : null}
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

export function CatalogLotCardView({
  lots,
  currentUserId,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
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
              href={lotPath(a)}
              topRight={
                <div className="flex flex-col items-end gap-2">
                  {owned ? <OwnerBadge owned className="pointer-events-auto" /> : null}
                  <LotWatchlistHeart
                    lot={a}
                    isAuthenticated={isAuthenticated}
                    watchedLotIds={watchedLotIds}
                    loginNextPath={loginNextPath}
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
                <h2 className="font-headline text-2xl font-light leading-tight text-on-surface group-hover:text-primary">
                  {a.title}
                </h2>
              }
              description={
                <>
                  {subtitle ? (
                    <p className="font-body text-sm text-on-surface-variant">{subtitle}</p>
                  ) : null}
                  <LotStatusOverlay lot={a} />
                </>
              }
              footer={
                <div className="flex flex-wrap items-baseline justify-between gap-4 pt-2">
                  <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
                    {formatMoney(a.currentPrice)}
                  </p>
                  {est ? (
                    <p className="font-label text-[length:var(--text-label-2)] uppercase tracking-wider text-on-surface-variant">
                      Est. {est}
                    </p>
                  ) : null}
                </div>
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
}: CatalogLotViewsProps) {
  return (
    <div className="-mx-4 max-w-none border-y border-border-hairline bg-surface-container-lowest sm:mx-auto sm:max-w-screen-2xl sm:rounded-xl sm:border sm:border-border-hairline">
      <ul className="divide-y divide-outline-variant/15 sm:rounded-xl">
        {lots.map((a) => {
          const img = a.images[0];
          const est = lotEstimateLine(a);
          const subtitle = lotSubtitle(a);
          return (
            <li key={a.id}>
              <LotCardList
                lotId={a.id}
                href={lotPath(a)}
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
                  <h2 className="font-headline text-base font-medium text-on-surface underline-offset-4 group-hover:underline sm:text-lg">
                    {a.title}
                  </h2>
                }
                subtitle={
                  subtitle ? (
                    <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant sm:text-sm">
                      {subtitle}
                    </p>
                  ) : null
                }
                trailing={
                  <div className="flex shrink-0 items-center gap-2">
                    <OwnerBadge owned={Boolean(currentUserId && a.sellerId === currentUserId)} />
                    <LotWatchlistHeart
                      lot={a}
                      isAuthenticated={isAuthenticated}
                      watchedLotIds={watchedLotIds}
                      loginNextPath={loginNextPath}
                      layout="inline"
                    />
                  </div>
                }
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-label text-[length:var(--text-label-1)] uppercase tracking-wider text-primary">
                        {formatMoney(a.currentPrice)}
                      </p>
                      {est ? (
                        <p className="mt-0.5 font-label text-[length:var(--text-label-2)] uppercase tracking-wider text-on-surface-variant">
                          Est. {est}
                        </p>
                      ) : null}
                    </div>
                    {a.status !== "draft" ? (
                      <div className="tabular-nums">
                        <LotStatusBadge
                          status={a.status}
                          startTime={a.startTime.toISOString()}
                          endTime={a.endTime.toISOString()}
                        />
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

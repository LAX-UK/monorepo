import { LotCard } from "@/components/marketing/lot-card";
import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { MediaImage } from "@/components/ui/media-image";
import { formatMoney } from "@/lib/format-currency";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPath } from "@/lib/seo/url";
import type { Lot } from "@auction/types";

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
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
      {lots.map((a) => {
        const img = a.images[0];
        const est = lotEstimateLine(a);
        const subtitle = lotSubtitle(a);
        const owned = Boolean(currentUserId && a.sellerId === currentUserId);
        return (
          <li key={a.id} className="min-w-0">
            <LotCard.Grid
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
              image={
                <MediaImage
                  src={img}
                  alt={a.title}
                  label="Lot artwork"
                  className="h-full w-full"
                  imgClassName="object-contain transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw"
                />
              }
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
                  <p className="mt-1 font-label text-[length:var(--text-label-1)] uppercase tracking-widest text-primary md:mt-2 md:text-xs">
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
            <LotCard.EditorialCalm
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
              image={
                <MediaImage
                  src={img}
                  alt={a.title}
                  label="Lot artwork"
                  className="h-full w-full"
                  imgClassName="object-contain transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                  sizes="(max-width: 768px) 100vw, 42rem"
                />
              }
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
                  <p className="font-label text-xs uppercase tracking-widest text-primary">
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
    <div className="-mx-4 max-w-none border-y border-outline-variant/15 bg-surface-container-lowest sm:mx-auto sm:max-w-screen-2xl sm:rounded-xl sm:border sm:border-outline-variant/15">
      <ul className="divide-y divide-outline-variant/15 sm:rounded-xl">
        {lots.map((a) => {
          const img = a.images[0];
          const est = lotEstimateLine(a);
          const subtitle = lotSubtitle(a);
          return (
            <li key={a.id}>
              <LotCard.List
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

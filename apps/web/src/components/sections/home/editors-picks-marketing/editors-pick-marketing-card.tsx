import { lotQuickLookFromEditorsPick } from "@/components/marketing/lot-quick-look/mappers";
import { MarketingLotOverlayActions } from "@/components/marketing/lot-quick-look/marketing-lot-overlay-actions";
import { LotViewTransitionLink } from "@/components/marketing/lot-view-transition-link";
import { MarketingLotTile } from "@/components/marketing/marketing-lot-tile";
import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { Button } from "@auction/ui/components/button";

type Props = {
  lot: EditorsPickLotCardVM;
  index: number;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath?: string;
};

/** Presentational tile for the home “Editor’s Picks” strip (Figma). */
export function EditorsPickMarketingCard({
  lot,
  index,
  isAuthenticated,
  watchedLotIds,
  loginNextPath = "/",
}: Props) {
  const initialWatching = watchedLotIds.includes(lot.id);

  return (
    <MarketingLotTile
      lotId={lot.id}
      index={index}
      href={lot.href}
      linkAriaLabel={`${lot.title} — view artwork`}
      imageUrl={lot.imageUrl}
      imageAlt={lot.imageAlt}
      sizes="280px"
      articleClassName="h-full"
      cornerAction={
        <MarketingLotOverlayActions
          lotId={lot.id}
          lotTitle={lot.title}
          initialWatching={initialWatching}
          isAuthenticated={isAuthenticated}
          loginNextPath={loginNextPath}
          vm={lotQuickLookFromEditorsPick(lot)}
          quickLookOptions={{
            isAuthenticated,
            watchedLotIds,
            loginNextPath,
          }}
        />
      }
      belowImage={
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <LotViewTransitionLink
              lotId={lot.id}
              href={lot.href}
              className="line-clamp-2 min-h-12 font-headline text-[20px] font-semibold leading-6 text-[#050505] underline-offset-2 hover:underline dark:text-on-surface"
            >
              {lot.title}
            </LotViewTransitionLink>
            <p className="line-clamp-1 min-h-4 font-body text-sm font-light leading-4 text-[#191919] dark:text-on-surface-variant">
              {lot.artistName}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-body text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
              {lot.estimateLabel}
            </span>
            <span className="line-clamp-1 font-body text-sm font-medium leading-4 text-[#474747] dark:text-on-surface-variant">
              {lot.estimateValue}
            </span>
          </div>
          <Button
            variant="outline"
            asChild
            className="mt-auto h-10 w-full rounded border-[#A3A3A3] text-base font-semibold tracking-[0.05em] text-[#0A0A0A] dark:border-neutral-500 dark:text-on-surface"
          >
            <LotViewTransitionLink lotId={lot.id} href={lot.href}>
              View Lot
            </LotViewTransitionLink>
          </Button>
        </div>
      }
    />
  );
}

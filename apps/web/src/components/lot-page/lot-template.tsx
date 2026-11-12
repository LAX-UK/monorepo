import type { LotActionContext } from "@/components/lot-page/lot-action-area";
import { LotAnnouncerProvider } from "@/components/lot-page/lot-announcer";
import { LotBidHistory } from "@/components/lot-page/lot-bid-history";
import { LotDetails } from "@/components/lot-page/lot-details";
import { LotIdentity } from "@/components/lot-page/lot-identity";
import { LotMedia } from "@/components/lot-page/lot-media/lot-media";
import { LotPageViewProvider } from "@/components/lot-page/lot-page-view-context";
import { LotPriceBlock } from "@/components/lot-page/lot-price-block";
import { LotSecondaryActions } from "@/components/lot-page/lot-secondary-actions";
import { LotTimeEffects } from "@/components/lot-page/lot-time-effects";
import type { LotTemplateData } from "@/lib/lot-page/lot-template-props";
import { LaxDensityProvider } from "@auction/ui/lax/density";
import { laxDensityAttributes } from "@auction/ui/lax/density-attributes";
import { TooltipProvider } from "@auction/ui/lax/tooltip";
import type { ReactNode } from "react";

export type LotTemplateProps = LotTemplateData & {
  /** The bid area of the price block: the bid button and the dialog it opens. */
  bidEntry: LotActionContext["bidEntry"];
  /** A notice above the work: a catalogue preview, or a sale on the floor now. */
  banner?: ReactNode;
  /** Under the history: the live stream and the condition report request. */
  supplementary?: ReactNode;
  /** After the details: more from the same seller. */
  footer?: ReactNode;
};

/**
 * The lot template: the work on the left and, beside it, who made it, the price and the one
 * thing to do next, then watch and share and the bid history; the details come below. One
 * layout for every moment of a lot's life, driven by the lot's view (see `buildLotPageView`).
 */
export function LotTemplate({
  source,
  lot,
  artist,
  factsLine,
  details,
  premiumPercent,
  bidEntry,
  sale,
  initialWatching,
  media,
  banner,
  supplementary,
  footer,
}: LotTemplateProps) {
  const actions: LotActionContext = {
    bidEntry,
    lotId: lot.id,
    artist: artist ? { id: artist.id, name: artist.name } : null,
    signedIn: source.signedIn,
    lotPath: lot.path,
    saleHref: sale.href,
    saleLabel: sale.label,
  };
  return (
    <LaxDensityProvider density="client">
      <TooltipProvider>
        <div {...laxDensityAttributes("client")} className="font-lax text-lax-fg">
          <LotPageViewProvider source={source}>
            <LotAnnouncerProvider>
              <LotTimeEffects />
              {banner ? <div className="mb-4">{banner}</div> : null}
              <div className="grid gap-6 pb-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14">
                <LotMedia
                  title={lot.title}
                  images={lot.images}
                  displayStyle={media.style}
                  pairsTwoFaces={media.pairsTwoFaces}
                />
                <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-offset,var(--header-height,4rem))+1.5rem)]">
                  <LotIdentity
                    lotNumber={lot.lotNumber}
                    title={lot.title}
                    artist={artist}
                    factsLine={factsLine}
                  />
                  <LotPriceBlock actions={actions} />
                  <LotSecondaryActions
                    lotId={lot.id}
                    title={lot.title}
                    shareUrl={lot.shareUrl}
                    initialWatching={initialWatching}
                    signedIn={source.signedIn}
                    lotPath={lot.path}
                  />
                  <LotBidHistory />
                  {supplementary ? <div className="mt-6 grid gap-4">{supplementary}</div> : null}
                </div>
              </div>
              <LotDetails details={details} premiumPercent={premiumPercent} />
              {footer}
            </LotAnnouncerProvider>
          </LotPageViewProvider>
        </div>
      </TooltipProvider>
    </LaxDensityProvider>
  );
}

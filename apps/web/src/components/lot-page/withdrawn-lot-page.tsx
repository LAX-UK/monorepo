import { LotDetails } from "@/components/lot-page/lot-details";
import { LotIdentity } from "@/components/lot-page/lot-identity";
import { LotImageStage } from "@/components/lot-page/lot-image-stage";
import { LotPageViewStaticProvider } from "@/components/lot-page/lot-page-view-context";
import { LotPriceBlock } from "@/components/lot-page/lot-price-block";
import { LotWayfinding } from "@/components/lot-page/lot-wayfinding";
import type { WithdrawnLotPageData } from "@/lib/lot-page/load-withdrawn-lot.server";
import { buildLotDetails, lotFactsLine } from "@/lib/lot-page/lot-details";
import { buildWithdrawnLotView } from "@/lib/lot-page/withdrawn-lot";
import { toGalleryImages } from "@auction/types";
import { LaxDensityProvider, TooltipProvider, laxDensityAttributes } from "@auction/ui/lax";

/**
 * A lot that has been withdrawn from its sale: the work, who made it and a notice with the way
 * back to the sale. No price, timing, history or actions: the public read carries none of them.
 */
export function WithdrawnLotPage({ data, now }: { data: WithdrawnLotPageData; now: Date }) {
  const { lot, artist, sale } = data;
  const view = buildWithdrawnLotView(now);
  return (
    <LaxDensityProvider density="client">
      <TooltipProvider>
        <div {...laxDensityAttributes("client")} className="font-lax text-lax-fg">
          <LotWayfinding
            backHref={sale.href}
            backLabel={sale.title ?? sale.label}
            prevHref={null}
            nextHref={null}
            positionLabel={null}
          />
          <LotPageViewStaticProvider view={view}>
            <div className="grid gap-6 pb-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14">
              <LotImageStage
                title={lot.title}
                images={toGalleryImages(lot.images, undefined, lot.title, lot.imageAssets)}
              />
              <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
                <LotIdentity
                  lotNumber={lot.lotNumber}
                  title={lot.title}
                  artist={artist}
                  factsLine={lotFactsLine(lot)}
                />
                <LotPriceBlock
                  actions={{
                    bidEntry: null,
                    lotId: lot.id,
                    artist: null,
                    signedIn: false,
                    lotPath: "",
                    saleHref: sale.href,
                    saleLabel: sale.label,
                  }}
                />
              </div>
            </div>
            <LotDetails
              details={buildLotDetails({ description: lot.description, marketingDetails: {} })}
              premiumPercent={null}
            />
          </LotPageViewStaticProvider>
        </div>
      </TooltipProvider>
    </LaxDensityProvider>
  );
}

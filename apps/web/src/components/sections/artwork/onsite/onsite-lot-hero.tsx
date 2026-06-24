import { SaleTypeBadge } from "@/components/marketing/sale-type-badge";
import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { LotStatePill } from "@/components/sections/artwork/online/lot-state-pill";
import { OnsiteSaleScheduleCountdown } from "@/components/sections/artwork/onsite/onsite-sale-schedule-countdown";
import { formatMoney } from "@/lib/format-currency";
import { saleFormatExplainerContextFromSale } from "@/lib/sale-format-explainer";
import { salePath } from "@/lib/seo/url";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { LotMediaBlock } from "../redesign/lot-media-block";

type SaleLifecyclePick = Pick<Sale, "status" | "deliveryMode"> | null;

type Props = {
  auction: Lot | PublicLotView;
  sale: Sale;
  summarySeed: LotSummarySeedVM;
  saleForLifecycle: SaleLifecyclePick;
  serverClockMs?: number;
  /** When true, render the "Watch live stream → #live-stream" button. Caller gates via policy. */
  showStreamCta?: boolean;
};

export function OnsiteLotHero({
  auction,
  sale,
  summarySeed,
  saleForLifecycle,
  serverClockMs,
  showStreamCta = false,
}: Props) {
  const lifecycleLot = {
    id: auction.id,
    status: auction.status,
    startTime: auction.startTime,
    endTime: auction.endTime,
    winnerId: auction.winnerId,
    currentPrice: auction.currentPrice,
  };

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-lowest shadow-xl lg:grid-cols-12">
      <div className="relative col-span-1 flex min-h-[300px] items-center justify-center bg-surface-container-high dark:bg-surface-container-highest sm:min-h-[400px] lg:col-span-7 lg:min-h-[500px]">
        <div className="w-full max-w-[900px] p-4 sm:p-6 lg:p-8">
          <LotMediaBlock lot={auction} wide={true} />
        </div>
      </div>

      <div className="col-span-1 flex flex-col justify-between border-t border-outline-variant/10 bg-surface-container-lowest p-6 sm:p-8 lg:col-span-5 lg:border-l lg:border-t-0 lg:p-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <SaleTypeBadge
              deliveryMode={sale.deliveryMode}
              size="sm"
              withExplainer
              explainerContext={saleFormatExplainerContextFromSale(sale)}
              className="border-outline-variant/30 bg-surface-container-low text-on-surface-variant"
            />
            {auction.lotNumber != null && (
              <span className="font-label text-xs font-bold uppercase tracking-widest text-secondary">
                Lot {auction.lotNumber}
              </span>
            )}
          </div>

          <LotStatePill
            lot={lifecycleLot}
            sale={saleForLifecycle}
            compact
            suppressCountdown
            {...(serverClockMs !== undefined ? { initialNowMs: serverClockMs } : {})}
          />

          <div className="space-y-2">
            <p className="font-body text-xs uppercase tracking-wide text-on-surface-variant/80">
              <Link href={salePath(sale)} className="hover:text-link hover:underline">
                {sale.title}
              </Link>
            </p>
            <h2 className="font-headline text-3xl font-bold leading-tight tracking-tight text-on-surface sm:text-4xl">
              {auction.title}
            </h2>
            {summarySeed.sellerHref ? (
              <Link
                href={summarySeed.sellerHref}
                className="font-body text-base font-medium text-on-surface-variant hover:text-link hover:underline"
              >
                {summarySeed.sellerName}
              </Link>
            ) : (
              <p className="font-body text-base font-medium text-on-surface-variant">
                {summarySeed.sellerName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 border-b border-t border-outline-variant/10 py-5">
            <div>
              <p className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
                Estimate
              </p>
              <p className="mt-1 font-body text-lg font-semibold text-on-surface">
                {summarySeed.estimateLine ?? "—"}
              </p>
            </div>
            {auction.startingPrice ? (
              <div>
                <p className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
                  Opening price
                </p>
                <p className="mt-1 font-body text-lg font-semibold text-on-surface">
                  {formatMoney(auction.startingPrice)}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8 space-y-6 border-t border-outline-variant/10 pt-6">
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-4 shadow-sm backdrop-blur-md">
            <OnsiteSaleScheduleCountdown sale={sale} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {showStreamCta ? (
              <Button variant="outline" className="flex-1" asChild>
                <a href="#live-stream">Watch live stream</a>
              </Button>
            ) : null}
            <Button variant="outline" className="flex-1" asChild>
              <Link href={salePath(sale)}>View catalogue</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

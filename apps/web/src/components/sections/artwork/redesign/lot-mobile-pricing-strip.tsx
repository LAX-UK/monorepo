import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { formatMoney } from "@/lib/format-currency";

type Props = {
  seed: LotSummarySeedVM;
  currentPrice: string;
  minNextBid: string;
  lotNumber?: number | null;
};

/** Compact estimate / current / min-next row for mobile online bid card. */
export function LotMobilePricingStrip({ seed, currentPrice, minNextBid, lotNumber }: Props) {
  return (
    <div className="mb-4 border-b border-outline-variant/30 pb-4 lg:hidden">
      <h2 className="font-body text-lg font-medium leading-tight text-on-surface">
        {lotNumber != null ? `${lotNumber}. ` : ""}
        {seed.title}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            Estimate
          </p>
          <p className="mt-0.5 font-body text-sm font-medium text-on-surface">
            {seed.estimateLine ?? "—"}
          </p>
        </div>
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            Current bid
          </p>
          <p className="mt-0.5 font-body text-sm font-semibold text-on-surface">
            {formatMoney(currentPrice)}
          </p>
        </div>
        <div className="col-span-2">
          <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            Min. next bid
          </p>
          <p className="mt-0.5 font-body text-sm font-medium text-on-surface">
            {formatMoney(minNextBid)}
          </p>
        </div>
      </div>
    </div>
  );
}

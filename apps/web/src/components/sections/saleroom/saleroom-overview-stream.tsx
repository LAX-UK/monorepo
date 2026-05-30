import { SaleStreamPreview } from "@/components/marketing/sale-stream-preview";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
};

/** Live stream preview (click-to-load embed) with external link fallback. */
export function SaleroomOverviewStream({ overview }: Props) {
  if (!overview.showLiveStream || !overview.streamUrl) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-lg font-semibold text-on-surface">Live stream</h3>
      <SaleStreamPreview
        streamUrl={overview.streamUrl}
        saleTitle={overview.saleTitle}
        posterUrl={overview.streamPosterUrl}
      />
    </div>
  );
}

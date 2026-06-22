import { SaleStreamPreview } from "@/components/marketing/sale-stream-preview";
import { Video } from "lucide-react";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
};

/** Phase-aware stream section for the sale overview panel. */
export function SaleroomOverviewStream({ overview }: Props) {
  if (!overview.showSalePageStream || !overview.streamUrl || !overview.streamPresentation) {
    return null;
  }

  const { streamPresentation: pres } = overview;

  return (
    <div className="mt-6">
      <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-on-surface">
        {pres.showPulseIcon ? (
          <Video className="size-5 animate-pulse text-primary" aria-hidden />
        ) : null}
        {pres.sectionHeading}
      </h3>
      <p className="mb-3 text-sm text-on-surface-variant">{pres.sectionBody}</p>
      <SaleStreamPreview
        streamUrl={overview.streamUrl}
        saleTitle={overview.saleTitle}
        posterUrl={overview.streamPosterUrl}
        presentation={pres}
      />
    </div>
  );
}

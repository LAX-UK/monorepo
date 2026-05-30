import type { Sale } from "@auction/types";
import { SaleroomOverviewAbout } from "./saleroom-overview-about";
import { SaleroomOverviewFacts } from "./saleroom-overview-facts";
import { SaleroomOverviewPlanVisit } from "./saleroom-overview-plan-visit";
import { SaleroomOverviewStream } from "./saleroom-overview-stream";
import { SaleroomOverviewTerms } from "./saleroom-overview-terms";
import { SaleroomOverviewVenue } from "./saleroom-overview-venue";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
  sale?: Sale;
  /** Optional featured lot titles for onsite engagement teaser. */
  featuredLotTitles?: readonly string[];
  /** When true, omit the “About this sale” copy (moved to hero). */
  hideDescription?: boolean;
};

/** Read-only marketing overview: composes facts, about, venue, stream, and terms. */
export function SaleroomOverviewPanel({
  overview,
  sale,
  featuredLotTitles,
  hideDescription = false,
}: Props) {
  return (
    <div className="mx-auto grid w-full max-w-[var(--container-max,1440px)] grid-cols-1 gap-6 lg:grid-cols-2">
      {sale ? (
        <SaleroomOverviewPlanVisit
          sale={sale}
          {...(featuredLotTitles ? { featuredLotTitles } : {})}
        />
      ) : null}

      <SaleroomOverviewFacts overview={overview} />

      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40">
        <SaleroomOverviewAbout overview={overview} hideDescription={hideDescription} />
        <SaleroomOverviewVenue overview={overview} />
        <SaleroomOverviewStream overview={overview} />
        <SaleroomOverviewTerms overview={overview} />
      </div>
    </div>
  );
}

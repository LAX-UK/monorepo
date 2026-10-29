import type { ConsignmentStageView } from "@/lib/organisation-home/organisation-dashboard-view";
import { cn } from "@auction/ui";
import Link from "next/link";
import { HOME_CELL_LINK_CLASS, HomeCellGrid } from "./home-cell-grid";
import { HomeSection } from "./home-section";

const CELL = "flex min-h-20 w-full flex-col-reverse justify-end gap-0.5 px-4 py-3";

function StageCell({ stage }: { stage: ConsignmentStageView }) {
  // The label comes first for assistive technology ("Sold, 4"); the count shows on top.
  const content = (
    <>
      <span className="font-body text-sm text-on-surface-variant">{stage.label}</span>
      <span className="font-headline text-xl font-semibold text-on-surface tabular-nums sm:text-2xl">
        <span className="sr-only">, </span>
        {stage.count}
      </span>
    </>
  );
  return (
    <Link href={stage.href} className={cn(CELL, HOME_CELL_LINK_CLASS)}>
      {content}
    </Link>
  );
}

/**
 * Works by stage as one row of counts on one card: only the stages with works in them, each
 * opening the Consignments list filtered to it.
 */
export function HomeConsignmentStages({ stages }: { stages: readonly ConsignmentStageView[] }) {
  return (
    <HomeSection id="home-consignment-stages" title="Consignments by stage">
      <HomeCellGrid
        labelledBy="home-consignment-stages"
        items={stages}
        itemKey={(stage) => stage.id}
        phoneColumns={Math.min(stages.length, 3) as 1 | 2 | 3}
        wideColumns={stages.length}
        // A few stages read as a short row of counts, not a stretched card.
        fit={stages.length <= 4}
        itemTestId={(stage) => `home-stage-${stage.id}`}
        renderItem={(stage) => <StageCell stage={stage} />}
      />
    </HomeSection>
  );
}

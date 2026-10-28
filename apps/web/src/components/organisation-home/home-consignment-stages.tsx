import type { ConsignmentStageView } from "@/lib/organisation-home/organisation-dashboard-view";
import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { HomeSectionHeading } from "./home-section-heading";

const CELL =
  "flex h-full min-h-16 flex-col-reverse justify-end gap-0.5 rounded-lg border border-border-hairline px-3 py-2.5";

/**
 * Works by stage as one compact row of counts. A stage with works opens the Consignments list
 * filtered to it; an empty stage is plain text, as there is nothing to open.
 */
export function HomeConsignmentStages({ stages }: { stages: readonly ConsignmentStageView[] }) {
  return (
    <Surface variant="section" padding="none" className="space-y-3 p-4 sm:p-6">
      <HomeSectionHeading id="home-consignment-stages">Consignments by stage</HomeSectionHeading>
      <ul
        aria-labelledby="home-consignment-stages"
        className="grid grid-cols-3 gap-2 lg:grid-cols-6"
      >
        {stages.map((stage) => {
          // The label comes first for assistive technology ("Sold, 4"); the count shows on top.
          const content = (
            <>
              <span className="font-body text-sm text-on-surface-variant">{stage.label}</span>
              <span
                className={cn(
                  "font-headline text-xl font-semibold tabular-nums sm:text-2xl",
                  stage.count > 0 ? "text-on-surface" : "text-on-surface-variant",
                )}
              >
                <span className="sr-only">, </span>
                {stage.count}
              </span>
            </>
          );
          return (
            <li key={stage.id} className="min-w-0" data-testid={`home-stage-${stage.id}`}>
              {stage.href ? (
                <Link
                  href={stage.href}
                  className={cn(
                    CELL,
                    "bg-surface-container-lowest transition-colors hover:border-outline-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div className={cn(CELL, "border-dashed")}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}

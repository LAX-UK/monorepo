import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { ConsignmentStageView } from "@/lib/organisation-home/organisation-dashboard-view";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";
import { HOME_CELL_LINK_CLASS, HOME_PANEL_CLASS, HomeSection } from "./home-section";

/**
 * Works by stage as one card of equal cells, always every stage: a row of six on wider screens,
 * three over three on phones. A stage with no works stays in place, muted, so each stage is found
 * where it was last time. Each cell opens the Consignments list filtered to it.
 */
export function HomeConsignmentStages({ stages }: { stages: readonly ConsignmentStageView[] }) {
  return (
    <HomeSection
      id="home-consignment-stages"
      title="Consignments by stage"
      link={{ href: CLIENT_ROUTES.consignments, label: "All consignments" }}
    >
      <ul
        aria-labelledby="home-consignment-stages"
        className={cn(
          HOME_PANEL_CLASS,
          "grid grid-cols-3 gap-px overflow-hidden bg-lax-line-subtle sm:grid-cols-6",
        )}
      >
        {stages.map((stage) => (
          <li
            key={stage.id}
            className="flex min-w-0 bg-lax-surface"
            data-testid={`home-stage-${stage.id}`}
            data-empty={stage.empty ? "" : undefined}
          >
            <Link
              href={stage.href}
              className={cn(
                "flex min-h-20 w-full flex-col-reverse justify-end px-3 py-3 sm:px-4 sm:py-4",
                HOME_CELL_LINK_CLASS,
              )}
            >
              {/* The label comes first for assistive technology ("Sold, 4"); the count shows on top. */}
              <span className="text-lax-12 text-lax-muted sm:text-lax-13">{stage.label}</span>
              <span
                className={cn(
                  "text-lax-18 tabular-nums sm:text-lax-20",
                  stage.empty ? "font-normal text-lax-muted" : "font-semibold text-lax-fg",
                )}
              >
                <span className="sr-only">, </span>
                {stage.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}

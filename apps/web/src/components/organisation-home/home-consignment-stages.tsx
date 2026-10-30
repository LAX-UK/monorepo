import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { ConsignmentStageView } from "@/lib/organisation-home/organisation-dashboard-view";
import { cn } from "@auction/ui";
import Link from "next/link";
import { HOME_CELL_LINK_CLASS, HomeSection } from "./home-section";

/** Columns, spelled out so Tailwind keeps them; up to five stages sit on one row. */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/**
 * Works by stage as one row of counts on one card: only the stages with works in them, each
 * opening the Consignments list filtered to it.
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
          "grid gap-px overflow-hidden rounded-lax-card border border-lax-line bg-lax-line-subtle",
          COLUMNS[Math.min(stages.length, 5)],
        )}
      >
        {stages.map((stage) => (
          <li
            key={stage.id}
            className="flex min-w-0 bg-lax-surface"
            data-testid={`home-stage-${stage.id}`}
          >
            <Link
              href={stage.href}
              className={cn(
                "flex w-full flex-col-reverse justify-end px-2.5 py-3 sm:px-5 sm:py-4",
                HOME_CELL_LINK_CLASS,
              )}
            >
              {/* The label comes first for assistive technology ("Sold, 4"); the count shows on top. */}
              <span className="truncate text-lax-12 text-lax-muted sm:text-lax-13">
                {stage.label}
              </span>
              <span className="text-lax-18 font-semibold text-lax-fg tabular-nums sm:text-lax-20">
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

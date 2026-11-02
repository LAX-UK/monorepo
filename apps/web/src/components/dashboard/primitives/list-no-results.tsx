import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { Button } from "@auction/ui/lax";
import Link from "next/link";

type Clear =
  /** The list's address without its filters. */
  | { clearHref: string; onClear?: never }
  /** Clears a filter held on the page, such as a search box. */
  | { onClear: () => void; clearHref?: never };

export type ListNoResultsProps = Clear & {
  /** Names the filter: "No consignments match “Sold”". */
  title: string;
  description: string;
  /** "Clear filters" unless the page has only a search: "Clear search". */
  clearLabel?: string;
};

/**
 * A list whose filters leave nothing to show: what matched nothing, and one way back to the
 * whole list. The quiet empty-state frame, so it reads as part of the list, not a failure.
 */
export function ListNoResults({
  title,
  description,
  clearLabel = "Clear filters",
  ...clear
}: ListNoResultsProps) {
  return (
    <DashboardEmptyState
      illustration="search"
      title={title}
      description={description}
      action={
        clear.clearHref ? (
          <Button variant="secondary" asChild>
            <Link href={clear.clearHref} scroll={false}>
              {clearLabel}
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={clear.onClear}>
            {clearLabel}
          </Button>
        )
      }
    />
  );
}

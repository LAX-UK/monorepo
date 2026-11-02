import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { ButtonLink, EmptyState } from "@auction/ui/lax";
import Link from "next/link";

/** Shown until the first sale has closed and been counted. */
export function ResultsFirstSaleEmpty() {
  return (
    <div className="rounded-lax-card border border-lax-line bg-lax-surface">
      <EmptyState
        illustration="ledger"
        headingLevel="h2"
        title="Results appear here after our first sale"
        description="Every sale’s prices and sell-through are published here within a day of the close."
        actions={
          <ButtonLink Link={Link} variant="primary" href={calendarSalesHref({ tab: "upcoming" })}>
            See upcoming sales
          </ButtonLink>
        }
      />
    </div>
  );
}

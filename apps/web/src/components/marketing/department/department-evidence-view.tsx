import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { DepartmentWorkCard } from "@/components/marketing/department/department-work-card";
import { MarketingSection } from "@/components/marketing/marketing-section";
import type { DepartmentEvidence } from "@/lib/departments/department-evidence";
import type { DepartmentDisplayStyle } from "@auction/domain";
import { MarketingWorkGrid } from "@auction/marketing-ui/marketing-work-card";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { EmptyState } from "@auction/ui/lax/empty-state";
import Link from "next/link";

type Props = {
  evidence: DepartmentEvidence;
  /** The department as the page names it: "Watches & clocks". */
  department: string;
  /** Lower case, for running text: "watches and clocks". */
  noun: string;
  /** How this department shows its lots. */
  displayStyle: DepartmentDisplayStyle;
};

/**
 * What the house has done in this department: works it sold and works on sale now. A row with
 * nothing to show is left out; "On sale" says so honestly when sold works are shown beside it.
 */
export function DepartmentEvidenceView({ evidence, department, noun, displayStyle }: Props) {
  const { sold, onSale } = evidence;
  const showOnSaleEmpty = onSale.length === 0 && sold.length > 0;

  return (
    <>
      {sold.length > 0 ? (
        <MarketingSection
          size="compact"
          id="department-sold"
          heading={`Recently sold in ${noun}`}
          subtitle="Prices include the buyer’s premium."
          action={{ href: evidence.soldHref, label: "View all", srSuffix: `sold in ${noun}` }}
        >
          <ViewItemListTracker
            listId={`department:${evidence.categoryId}:sold`}
            listName={`${department}: recently sold`}
            itemIds={sold.map((work) => work.lot.id)}
          />
          <MarketingWorkGrid aria-label={`Recently sold in ${noun}`}>
            {sold.map(({ lot }) => (
              <DepartmentWorkCard key={lot.id} lot={lot} displayStyle={displayStyle} />
            ))}
          </MarketingWorkGrid>
        </MarketingSection>
      ) : null}

      {onSale.length > 0 ? (
        <MarketingSection
          size="compact"
          id="department-on-sale"
          heading="On sale now"
          action={{ href: evidence.onSaleHref, label: "View all", srSuffix: `on sale in ${noun}` }}
        >
          <ViewItemListTracker
            listId={`department:${evidence.categoryId}:on-sale`}
            listName={`${department}: on sale`}
            itemIds={onSale.map((lot) => lot.id)}
          />
          <MarketingWorkGrid aria-label={`On sale in ${noun}`}>
            {onSale.map((lot) => (
              <DepartmentWorkCard key={lot.id} lot={lot} displayStyle={displayStyle} />
            ))}
          </MarketingWorkGrid>
        </MarketingSection>
      ) : null}

      {showOnSaleEmpty ? (
        <MarketingSection size="compact" id="department-on-sale" heading="On sale now">
          <div className="rounded-xl border border-border-hairline bg-surface">
            <EmptyState
              illustration="frame"
              headingLevel="h3"
              title={`Nothing is on sale in ${noun} right now`}
              description="Works appear here as soon as a sale opens. The calendar shows what is coming up."
              actions={
                <ButtonLink Link={Link} variant="secondary" href="/sales">
                  See the calendar
                </ButtonLink>
              }
            />
          </div>
        </MarketingSection>
      ) : null}
    </>
  );
}

import { NewsletterSignupForm } from "@/components/sections/home/newsletter-signup-form";
import { SalesCalendarWhileYouWait } from "@/components/sections/sales/sales-calendar-while-you-wait";
import type { SalesBrowsePageVM } from "@/lib/marketing/sales-browse-page.vm";
import {
  SEE_RECENT_RESULTS,
  resolveCalendarEmptyState,
} from "@/lib/marketing/sales-calendar-empty-state";
import { calendarClearFiltersHref } from "@/lib/marketing/sales-calendar-params";
import { ButtonLink, EmptyState } from "@auction/ui/lax";
import Link from "next/link";

type Props = { vm: SalesBrowsePageVM };

/** A calendar tab with nothing to show. The filtered miss and the quiet calendar are different states. */
export function SalesCalendarEmpty({ vm }: Props) {
  const empty = resolveCalendarEmptyState({
    tab: vm.tab,
    hasActiveFilters: vm.hasActiveCalendarFilters,
  });

  if (empty.kind === "clearFilters") {
    return (
      <EmptyState
        illustration="search"
        title={empty.title}
        description={empty.description}
        actions={
          <>
            <ButtonLink
              Link={Link}
              variant="primary"
              href={calendarClearFiltersHref(vm.calendarState)}
            >
              Clear filters
            </ButtonLink>
            <ButtonLink Link={Link} variant="secondary" href="/sales">
              Browse all sales
            </ButtonLink>
          </>
        }
      />
    );
  }

  return (
    <>
      <EmptyState
        illustration="easel"
        title={empty.title}
        description={empty.description}
        actions={
          <div className="flex w-full flex-col gap-3 [&>div>*]:mx-0">
            <div>
              <NewsletterSignupForm />
            </div>
            <p className="text-lax-12 leading-4 text-lax-muted">
              The LAX Bid newsletter: new sales and results. Unsubscribe at any time.
            </p>
            {empty.offersRecentResults ? (
              <ButtonLink
                Link={Link}
                variant="secondary"
                href={SEE_RECENT_RESULTS.href}
                className="self-start"
              >
                {SEE_RECENT_RESULTS.label}
              </ButtonLink>
            ) : null}
          </div>
        }
      />
      <SalesCalendarWhileYouWait links={vm.whileYouWait} />
    </>
  );
}

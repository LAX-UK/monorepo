import { PortfolioNoticeToast } from "@/components/dashboard/portfolio-notice-toast";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { ListNoResults } from "@/components/dashboard/primitives/list-no-results";
import { PayNowBanner } from "@/components/dashboard/purchases/pay-now-banner";
import { PurchaseCard } from "@/components/dashboard/purchases/purchase-card";
import {
  PurchasesActiveFilters,
  PurchasesFilters,
} from "@/components/dashboard/purchases/purchases-filters";
import { ACCOUNT_LOAD_ERROR, DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import type { PortfolioFilters } from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { PurchaseTab } from "@/lib/purchases/purchase-progress";
import type { PurchasesVm } from "@/lib/purchases/purchases.vm";
import { AccountViewTabs } from "@auction/marketing-ui";
import { RecordList } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Info } from "lucide-react";
import Link from "next/link";

const EMPTY_VIEW: Record<PurchaseTab, { title: string; description: string }> = {
  "to-pay": {
    title: "Nothing to pay",
    description: "Lots you win wait here until they are paid for.",
  },
  "in-progress": {
    title: "Nothing on its way",
    description: "Paid lots stay here while we prepare them for collection or delivery.",
  },
  completed: {
    title: "Nothing completed yet",
    description: "Lots move here once they are delivered or collected.",
  },
};

function tabHref(tab: PurchaseTab): string {
  return `${CLIENT_ROUTES.purchases}?tab=${tab}`;
}

/** Nothing won yet; someone who may bid is pointed to the sales, everyone else is told why. */
function NothingWonYet({ offersSales }: { offersSales: boolean }) {
  return (
    <DashboardEmptyState
      variant="hero"
      illustration="parcel"
      title={DASHBOARD_EMPTY.purchases.title}
      description={DASHBOARD_EMPTY.purchases.description}
      {...(offersSales
        ? {
            action: (
              <Button variant="secondaryOutline" asChild>
                <Link href={calendarSalesHref({ tab: "live" })}>{DASHBOARD_CTA.seeWhatsOn}</Link>
              </Button>
            ),
          }
        : {})}
    />
  );
}

function PortfolioNote() {
  return (
    <p className="flex items-start gap-1.5 font-body text-sm text-on-surface-variant">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        Your whole collection across LAX Bid, LAX Shop and lax.art is in{" "}
        <a
          href={laxAccountUrl("/account/portfolio")}
          className="text-on-surface underline underline-offset-4 hover:decoration-2"
        >
          LAX Account, Portfolio
        </a>
        .
      </span>
    </p>
  );
}

/**
 * The body of Purchases: "Pay now" while anything is due, the views (To pay, In progress,
 * Completed) and a card per won lot. `vm` is `null` when the won lots could not be read.
 */
export function PurchasesView({
  vm,
  filters,
  offersSales,
}: {
  vm: PurchasesVm | null;
  filters: PortfolioFilters;
  offersSales: boolean;
}) {
  if (!vm) return <AccountLoadError {...ACCOUNT_LOAD_ERROR.purchases} />;
  const filtered = vm.shown < vm.total;
  const empty = EMPTY_VIEW[vm.tab];
  return (
    <div className="flex flex-col gap-6">
      <PortfolioNoticeToast />
      {vm.total === 0 ? (
        <NothingWonYet offersSales={offersSales} />
      ) : (
        <>
          {vm.payNow ? <PayNowBanner banner={vm.payNow} /> : null}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AccountViewTabs
                label="Purchases"
                currentId={vm.tab}
                tabs={vm.tabs.map((tab) => ({ ...tab, href: tabHref(tab.id) }))}
              />
              <div className="flex items-center gap-4 max-md:w-full max-md:justify-between">
                <p className="whitespace-nowrap font-body text-xs text-on-surface-variant md:text-sm">
                  {vm.total === 1 ? "1 purchase" : `${vm.total} purchases`} · {vm.spent} in total
                </p>
                <PurchasesFilters filters={filters} years={vm.years} />
              </div>
            </div>
            <PurchasesActiveFilters filters={filters} />
          </div>
          {vm.cards.length > 0 ? (
            <RecordList aria-label="Your purchases">
              {vm.cards.map((card) => (
                <PurchaseCard key={card.lotId} card={card} />
              ))}
            </RecordList>
          ) : filtered ? (
            <ListNoResults
              title="No purchases match these filters"
              description="Clear the filters or choose another view to see more."
              clearHref={tabHref(vm.tab)}
            />
          ) : (
            <DashboardEmptyState
              illustration="parcel"
              title={empty.title}
              description={empty.description}
            />
          )}
          <PortfolioNote />
        </>
      )}
    </div>
  );
}

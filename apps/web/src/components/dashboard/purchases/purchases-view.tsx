import { PortfolioNoticeToast } from "@/components/dashboard/portfolio-notice-toast";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { PayNowBanner } from "@/components/dashboard/purchases/pay-now-banner";
import { PurchaseCard } from "@/components/dashboard/purchases/purchase-card";
import { ACCOUNT_LOAD_ERROR, DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { PurchaseTab } from "@/lib/purchases/purchase-progress";
import type { PurchasesVm } from "@/lib/purchases/purchases.vm";
import { AccountViewTabs } from "@auction/marketing-ui";
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

function NothingWonYet() {
  return (
    <DashboardEmptyState
      variant="hero"
      illustration="parcel"
      title={DASHBOARD_EMPTY.purchases.title}
      description={DASHBOARD_EMPTY.purchases.description}
      action={
        <Button variant="secondaryOutline" asChild>
          <Link href={calendarSalesHref({ tab: "live" })}>{DASHBOARD_CTA.seeWhatsOn}</Link>
        </Button>
      }
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
export function PurchasesView({ vm }: { vm: PurchasesVm | null }) {
  if (!vm) return <AccountLoadError {...ACCOUNT_LOAD_ERROR.purchases} />;
  const empty = EMPTY_VIEW[vm.tab];
  return (
    <div className="flex flex-col gap-6">
      <PortfolioNoticeToast />
      {vm.total === 0 ? (
        <NothingWonYet />
      ) : (
        <>
          {vm.payNow ? <PayNowBanner banner={vm.payNow} /> : null}
          <AccountViewTabs
            label="Purchases"
            currentId={vm.tab}
            tabs={vm.tabs.map((tab) => ({ ...tab, href: tabHref(tab.id) }))}
          />
          {vm.cards.length === 0 ? (
            <DashboardEmptyState
              illustration="parcel"
              title={empty.title}
              description={empty.description}
            />
          ) : (
            <ul className="flex flex-col gap-4" aria-label="Your purchases">
              {vm.cards.map((card) => (
                <li key={card.lotId}>
                  <PurchaseCard card={card} />
                </li>
              ))}
            </ul>
          )}
          <PortfolioNote />
        </>
      )}
    </div>
  );
}

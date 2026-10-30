import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { PaymentsMobileList } from "@/components/dashboard/list/payments-mobile-list";
import { PaymentRowCard } from "@/components/dashboard/payments/payment-row-card";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/primitives";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardDesktopList } from "@/components/dashboard/primitives/dashboard-list-row-card";
import { OrgWorksList } from "@/components/dashboard/seller/org-works-list";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { ACCOUNT_LOAD_ERROR, DASHBOARD_CTA } from "@/lib/dashboard/dashboard-copy";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import {
  ENTITY_WORKS_PAGING,
  type EntityWonLot,
  type MyPaymentRow,
  getServerEntityPayments,
  getServerEntityWonLots,
} from "@/lib/data/http/payments.server";
import {
  type PaymentDisplayRow,
  sortPaymentsNewestFirst,
  toPaymentDisplayRows,
} from "@/lib/data/view-models/dashboard-payments.vm";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { toOrgWorkRows } from "./org-works.vm";

const PATH = CLIENT_ROUTES.collection;

/**
 * The organisation's own works: lots it has won, whichever member bid, and (for roles with
 * finance access) what it paid. A person's own purchases live in Purchases, so this page is only
 * for an organisation.
 */
export default async function CollectionPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: PATH });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  // A person's own works are in Purchases and LAX Account; this page is an organisation's.
  if (!sellerCtx.sellingAsOrganisation) redirect(CLIENT_ROUTES.consignments);
  const refusal = workspacePageRefusal(PATH, sellerCtx.actor);
  if (refusal) {
    return (
      <>
        <SetMobileShellTitle title={refusal.label} />
        <WorkspacePageNoAccess label={refusal.label} openedBy={refusal.openedBy} next={PATH} />
      </>
    );
  }
  const canViewMoney = sellerCan(sellerCtx, "entity.finance.read");
  // Only someone who may bid is offered the sales; the rest are told what will appear.
  const canBid = sellerCan(sellerCtx, "entity.bid.place");

  const [winsResult, paymentsResult] = await Promise.allSettled([
    getServerEntityWonLots(),
    canViewMoney ? getServerEntityPayments() : Promise.resolve([] as MyPaymentRow[]),
  ]);

  let wins: EntityWonLot[] = [];
  let winsComplete = true;
  const winsFailed = winsResult.status === "rejected";
  if (winsResult.status === "fulfilled") {
    wins = winsResult.value.rows;
    winsComplete = winsResult.value.complete;
  }

  let payments: PaymentDisplayRow[] = [];
  let paymentsFailure = null;
  if (paymentsResult.status === "fulfilled") {
    payments = sortPaymentsNewestFirst(toPaymentDisplayRows(paymentsResult.value));
  } else {
    paymentsFailure = describeDashboardSliceFailure(
      paymentsResult.reason,
      "payments",
      "Could not load your organisation's payments.",
    );
  }

  const rows = toOrgWorkRows(wins);

  return (
    <DashboardListPage
      title="Works"
      description={
        canViewMoney
          ? "Works your organisation has won, what it paid and its invoices."
          : "Works your organisation has won. Prices and payments are visible to owners, admins and finance."
      }
      className="space-y-8"
    >
      {winsFailed ? (
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.works} />
      ) : rows.length === 0 ? (
        <DashboardEmptyState
          variant="hero"
          illustration="easel"
          title="No works yet"
          description="Lots won for this organisation appear here, whichever member placed the winning bid."
          {...(canBid
            ? {
                action: (
                  <Button variant="primary" asChild>
                    <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <section aria-labelledby="works-won-heading" className="flex flex-col gap-4">
          <h2
            id="works-won-heading"
            className="font-headline text-lg font-semibold text-on-surface"
          >
            Works won
          </h2>
          <OrgWorksList rows={rows} />
          {winsComplete ? null : (
            <p className="font-body text-sm text-on-surface-variant">
              Showing the latest {ENTITY_WORKS_PAGING.maxRows.toLocaleString("en-GB")} works.
            </p>
          )}
        </section>
      )}

      {paymentsFailure ? (
        <DashboardSliceErrorAlert failure={paymentsFailure} />
      ) : payments.length > 0 ? (
        <DashboardSection id="payment-history" title="Payments and invoices">
          <PaymentsMobileList rows={payments} />
          <DashboardDesktopList>
            <ul className="divide-y divide-outline-variant/10">
              {payments.map((row) => (
                <PaymentRowCard key={row.id} row={row} />
              ))}
            </ul>
          </DashboardDesktopList>
        </DashboardSection>
      ) : null}
    </DashboardListPage>
  );
}

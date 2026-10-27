import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { PaymentsMobileList } from "@/components/dashboard/list/payments-mobile-list";
import { PaymentRowCard } from "@/components/dashboard/payments/payment-row-card";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardDesktopList } from "@/components/dashboard/primitives/dashboard-list-row-card";
import { OrgWorksList } from "@/components/dashboard/seller/org-works-list";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import {
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
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { toOrgWorkRows } from "./org-works.vm";

const PATH = "/selling/works";

/**
 * The organisation's own works: lots it has won, whichever member bid, and (for roles with
 * finance access) what it paid. A person's own purchases live in Purchases, so this page is only
 * for an organisation.
 */
export default async function SellerWorksPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: PATH });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const canViewMoney = sellerCan(sellerCtx, "entity.finance.read");
  if (
    !sellerCtx.sellingAsOrganisation ||
    !(canViewMoney || sellerCan(sellerCtx, "entity.holdings.read"))
  ) {
    redirect("/selling");
  }

  const [winsResult, paymentsResult] = await Promise.allSettled([
    getServerEntityWonLots(),
    canViewMoney ? getServerEntityPayments() : Promise.resolve([] as MyPaymentRow[]),
  ]);

  let wins: EntityWonLot[] = [];
  let winsFailure = null;
  if (winsResult.status === "fulfilled") wins = winsResult.value;
  else {
    winsFailure = describeDashboardSliceFailure(
      winsResult.reason,
      "portfolio",
      "Could not load your organisation's works.",
    );
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
      errorAlert={winsFailure ? <DashboardSliceErrorAlert failure={winsFailure} /> : null}
      className="space-y-8"
    >
      {winsFailure ? null : (
        <DashboardSection id="organisation-works" title="Works won">
          {rows.length === 0 ? (
            <DashboardEmptyState
              variant="hero"
              illustration="easel"
              title="No works yet"
              description="Lots won for this organisation appear here, whichever member placed the winning bid."
              action={
                <Button variant="primary" asChild>
                  <Link href="/search">Browse live auctions</Link>
                </Button>
              }
            />
          ) : (
            <OrgWorksList rows={rows} />
          )}
        </DashboardSection>
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

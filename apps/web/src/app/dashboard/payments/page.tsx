import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import { PaymentsMobileList } from "@/components/dashboard/list/payments-mobile-list";
import { PaymentRowCard } from "@/components/dashboard/payments/payment-row-card";
import { PaymentsListToolbar } from "@/components/dashboard/payments/payments-list-toolbar";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardDesktopList } from "@/components/dashboard/primitives/dashboard-list-row-card";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import {
  hasPaymentsActiveFilters,
  parsePaymentsParams,
} from "@/lib/dashboard/filters/payments/payments-filters";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  type PaymentDisplayRow,
  filterPaymentRows,
  paymentYears,
  sortPaymentDisplayRows,
  toPaymentDisplayRows,
} from "@/lib/data/view-models/dashboard-payments.vm";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { Button } from "@auction/ui/components/button";
import { CreditCard } from "lucide-react";
import Link from "next/link";

const PAGE_PATH = "/dashboard/payments";

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; year?: string }>;
};

export default async function DashboardPaymentsPage({ searchParams }: PageProps) {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: PAGE_PATH,
  });
  const sp = await searchParams;
  const filters = parsePaymentsParams(sp);
  const qLower = filters.q.trim().toLowerCase();
  const filter = filters.status;
  const sort = filters.sort;
  const year = filters.year;

  const container = await getServerDataContainer();
  let allRows: PaymentDisplayRow[] = [];
  let displayRows: PaymentDisplayRow[] = [];
  let loadFailure: DashboardSliceFailure | null = null;
  try {
    const apiRows = await container.payments.listMine(
      filter === "all" ? undefined : { status: filter },
    );
    allRows = toPaymentDisplayRows(apiRows);
    displayRows = sortPaymentDisplayRows(filterPaymentRows(allRows, { qLower, year }), sort);
  } catch (e) {
    loadFailure = describeDashboardSliceFailure(e, "payments", "Could not load your payments.");
  }

  const years = paymentYears(allRows);
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardListPage
      meta={workspaceMeta}
      title="My payments"
      description="Invoices and receipts for lots you have won. Each row links to the lot and, when issued, the hosted invoice."
      toolbar={!loadFailure ? <PaymentsListToolbar filters={filters} years={years} /> : null}
      errorAlert={loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
    >
      {!loadFailure ? (
        <DashboardFilterResultsAnnouncer count={displayRows.length} entityLabel="payments" />
      ) : null}

      <section>
        {!loadFailure && displayRows.length === 0 ? (
          !hasPaymentsActiveFilters(filters) ? (
            <DashboardEmptyState
              variant="hero"
              icon={<CreditCard aria-hidden />}
              title={DASHBOARD_EMPTY.payments.title}
              description={DASHBOARD_EMPTY.payments.description}
              action={
                <Button variant="primary" asChild>
                  <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
                </Button>
              }
            />
          ) : (
            <FilterEmptyState segment="dashboard" entity="payments" clearFiltersHref={PAGE_PATH} />
          )
        ) : null}

        {displayRows.length > 0 ? (
          <DashboardSection id="payments-list" title="Payment history">
            <PaymentsMobileList rows={displayRows} />
            <DashboardDesktopList>
              <ul className="divide-y divide-outline-variant/10">
                {displayRows.map((row) => (
                  <PaymentRowCard key={row.id} row={row} />
                ))}
              </ul>
            </DashboardDesktopList>
          </DashboardSection>
        ) : null}
      </section>
    </DashboardListPage>
  );
}

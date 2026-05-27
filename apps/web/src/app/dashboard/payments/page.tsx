import {
  DashboardComplianceStrip,
  DashboardComplianceStripSkeleton,
} from "@/components/dashboard/dashboard-compliance-strip";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { PaymentsPageToolbar } from "@/components/dashboard/payments-page-toolbar";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { MediaImage } from "@/components/ui/media-image";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  type PaymentDisplayRow,
  filterPaymentRows,
  parsePaymentsSort,
  paymentYears,
  sortPaymentDisplayRows,
  toPaymentDisplayRows,
} from "@/lib/data/view-models/dashboard-payments.vm";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { parsePaymentsStatusFilter } from "./payments-status-filter";

const PAGE_PATH = "/dashboard/payments";

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; year?: string }>;
};

function statusVariant(tone: PaymentDisplayRow["statusTone"]) {
  switch (tone) {
    case "success":
      return "success" as const;
    case "danger":
      return "danger" as const;
    case "info":
      return "info" as const;
    case "neutral":
      return "neutral" as const;
  }
}

function PrimaryActionCell({ row }: { row: PaymentDisplayRow }) {
  const action = row.primaryAction;
  if (action.kind === "none") {
    return <span className="text-xs text-on-surface-variant">—</span>;
  }
  if (action.kind === "pay") {
    return (
      <Button variant="primary" asChild className="min-h-11 px-4 py-2 text-[10px]">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={action.ariaLabel}
      className="inline-flex min-h-11 items-center text-xs font-semibold text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {action.label}
    </a>
  );
}

function PaymentRowCard({ row }: { row: PaymentDisplayRow }) {
  return (
    <li className="lift-row">
      <Surface variant="card" padding="md" className="transition-colors hover:border-primary/20">
        <div className="grid gap-3 text-sm sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center">
          <Link
            href={lotPath({ id: row.lotId, title: row.lotTitle })}
            className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={`View ${row.lotTitle}`}
          >
            <MediaImage src={row.lotImageUrl} alt="" label="Lot artwork" sizes="56px" />
          </Link>
          <div className="min-w-0">
            <Link
              href={lotPath({ id: row.lotId, title: row.lotTitle })}
              className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {row.lotTitle}
            </Link>
            <p className="text-xs text-on-surface-variant">
              <time dateTime={row.createdAtIso}>{row.createdAtLabel}</time>
              {row.invoiceNumber ? <> · Invoice {row.invoiceNumber}</> : null}
            </p>
          </div>
          <div className="text-right text-base font-semibold tabular-nums text-on-surface sm:text-base">
            {row.amountLabel}
          </div>
          <div className="flex items-center justify-end">
            <StatusBadge variant={statusVariant(row.statusTone)} size="sm">
              {row.statusLabel}
            </StatusBadge>
          </div>
          <div className="flex justify-end sm:justify-center">
            <PrimaryActionCell row={row} />
          </div>
        </div>
      </Surface>
    </li>
  );
}

export default async function DashboardPaymentsPage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: PAGE_PATH,
  });
  const sp = await searchParams;
  const filter = parsePaymentsStatusFilter(sp.status);
  const qLower = (sp.q ?? "").trim().toLowerCase();
  const sort = parsePaymentsSort(sp.sort);
  const yearRaw = sp.year;
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number.parseInt(yearRaw, 10) : null;

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

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta="Buying"
        title="My payments"
        description="Invoices and receipts for lots you have won. Each row links to the lot and, when issued, the hosted invoice."
      />

      <Suspense fallback={<DashboardComplianceStripSkeleton />}>
        <DashboardComplianceStrip user={user} loginNext={PAGE_PATH} />
      </Suspense>

      {!loadFailure ? (
        <PaymentsPageToolbar
          filter={filter}
          initialQ={sp.q ?? ""}
          sort={sort}
          year={year}
          years={years}
        />
      ) : null}

      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}

      <section aria-live="polite" aria-busy="false">
        {!loadFailure && displayRows.length === 0 ? (
          filter === "all" && !qLower && year == null ? (
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
            <DashboardEmptyState
              title="No payments match this filter"
              description="Try a different status or clear the filter to see everything."
              action={
                <Button variant="secondaryOutline" asChild>
                  <Link href={PAGE_PATH}>Show all</Link>
                </Button>
              }
            />
          )
        ) : null}

        {displayRows.length > 0 ? (
          <DashboardSection id="payments-list" title="Payment history">
            <ul className="space-y-3">
              {displayRows.map((row) => (
                <PaymentRowCard key={row.id} row={row} />
              ))}
            </ul>
          </DashboardSection>
        ) : null}
      </section>
    </DashboardPage>
  );
}

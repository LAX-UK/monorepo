import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/media-image";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  type PaymentDisplayRow,
  sortPaymentsNewestFirst,
  toPaymentDisplayRows,
} from "@/lib/data/view-models/dashboard-payments.vm";
import { lotPath } from "@/lib/seo/url";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";
import {
  PAYMENTS_STATUS_FILTER_OPTIONS,
  type PaymentsStatusFilter,
  parsePaymentsStatusFilter,
  paymentsFilterHref,
} from "./payments-status-filter";

const PAGE_PATH = "/dashboard/payments";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
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

function FilterChips({ active }: { active: PaymentsStatusFilter }) {
  return (
    <nav aria-label="Filter payments by status" className="flex flex-wrap gap-2">
      {PAYMENTS_STATUS_FILTER_OPTIONS.map((opt) => {
        const isActive = opt.value === active;
        return (
          <Link
            key={opt.value}
            href={paymentsFilterHref(PAGE_PATH, opt.value)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isActive
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </nav>
  );
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
    <li>
      <Card>
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center">
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
          <div className="text-right text-base font-semibold tabular-nums sm:text-base">
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
        </CardContent>
      </Card>
    </li>
  );
}

export default async function DashboardPaymentsPage({ searchParams }: PageProps) {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: PAGE_PATH,
  });
  const sp = await searchParams;
  const filter = parsePaymentsStatusFilter(sp.status);

  const container = await getServerDataContainer();
  let displayRows: PaymentDisplayRow[] = [];
  let fetchError: string | null = null;
  try {
    const apiRows = await container.payments.listMine(
      filter === "all" ? undefined : { status: filter },
    );
    displayRows = sortPaymentsNewestFirst(toPaymentDisplayRows(apiRows));
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not load your payments.";
  }

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="My payments"
        description="Invoices and receipts for lots you have won. Each row links to the lot and, when issued, the hosted invoice."
        className="border-0 pb-0"
      />

      <FilterChips active={filter} />

      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load payments</AlertTitle>
          <AlertDescription>
            {fetchError} Refresh the page or try again in a few minutes.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-live="polite" aria-busy="false">
        {!fetchError && displayRows.length === 0 ? (
          filter === "all" ? (
            <EmptyState
              title="No payments yet"
              description="Your purchases will appear here once you win a lot and an invoice is issued."
              action={
                <Button variant="primary" asChild>
                  <Link href="/">Browse auctions</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No payments match this filter"
              description="Try a different status or clear the filter to see everything."
              action={
                <Button variant="secondary" asChild>
                  <Link href={PAGE_PATH}>Show all</Link>
                </Button>
              }
            />
          )
        ) : null}

        {displayRows.length > 0 ? (
          <ul className="space-y-3">
            {displayRows.map((row) => (
              <PaymentRowCard key={row.id} row={row} />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

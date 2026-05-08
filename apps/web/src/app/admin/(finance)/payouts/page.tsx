import { AdminPayoutReverseButton } from "@/components/admin/admin-payout-reverse-button";
import {
  addPayoutAdjustmentAction,
  markPayoutPaidAction,
  runPayoutSettlementAction,
} from "@/lib/admin/payout.actions";
import { getAdminPayoutList } from "@/lib/data/http/admin.server";
import { type PayoutStatus, payoutStatuses } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

const filters = ["all", ...payoutStatuses] as const;

function parseStatus(status: string | undefined): PayoutStatus | undefined {
  return payoutStatuses.includes(status as PayoutStatus) ? (status as PayoutStatus) : undefined;
}

function formatMoney(amount: string, currency: string): string {
  const value = Number.parseFloat(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
}

function formatDate(input: string | null): string {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function badgeClass(status: PayoutStatus): string {
  switch (status) {
    case "paid":
      return "bg-success/10 text-success";
    case "failed":
    case "reversed":
    case "clawback_pending":
      return "bg-error/10 text-error";
    case "in_transit":
      return "bg-primary/10 text-primary";
    default:
      return "bg-surface-container text-on-surface-variant";
  }
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    status?: string;
    legalEntityId?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const legalEntityId = sp.legalEntityId?.trim() || undefined;
  const success = sp.success ? decodeURIComponent(sp.success) : null;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  let payouts: Awaited<ReturnType<typeof getAdminPayoutList>> = [];
  let loadError: string | null = null;
  try {
    payouts = await getAdminPayoutList({
      ...(status ? { status } : {}),
      ...(legalEntityId ? { legalEntityId } : {}),
      limit: 100,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load payouts.";
  }

  const scheduled = payouts.filter((p) => p.status === "scheduled").length;
  const inTransit = payouts.filter((p) => p.status === "in_transit").length;
  const clawbackPending = payouts.filter((p) => p.status === "clawback_pending").length;
  const paid = payouts.filter((p) => p.status === "paid").length;
  const totalNet = payouts.reduce((sum, p) => sum + Number.parseFloat(p.netAmount || "0"), 0);

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Payouts"
        description="Run seller settlements, review payout totals, add finance adjustments, and mark Stripe transfers as paid."
      />

      {success ? (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not complete action</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-3 md:grid-cols-5">
        <MetricCard label="Scheduled" value={String(scheduled)} />
        <MetricCard label="In transit" value={String(inTransit)} />
        <MetricCard label="Clawback pending" value={String(clawbackPending)} />
        <MetricCard label="Paid" value={String(paid)} />
        <MetricCard label="Visible net" value={formatMoney(totalNet.toFixed(2), "GBP")} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <h2 className="font-heading text-lg">Run settlement</h2>
            <p className="text-sm text-on-surface-variant">
              Create a payout from captured payments that are not already linked to a payout line.
              When the worker and API share <code className="text-xs">CRON_INTERNAL_SECRET</code>, a
              daily job also settles every eligible legal entity automatically; this form runs one
              entity on demand.
            </p>
            <form action={runPayoutSettlementAction} className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Legal entity ID</span>
                <input
                  name="legalEntityId"
                  required
                  placeholder="00000000-0000-4000-8000-000000000000"
                  className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary"
              >
                Run settlement
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <h2 className="font-heading text-lg">Filters</h2>
            <form className="space-y-3" action="/admin/payouts">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Legal entity ID</span>
                <input
                  name="legalEntityId"
                  defaultValue={legalEntityId}
                  placeholder="Optional"
                  className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="rounded-md border border-outline-variant px-4 py-2 font-label text-sm font-semibold"
              >
                Apply
              </button>
            </form>
          </CardContent>
        </Card>
      </section>

      <nav className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Payout status filters">
        {filters.map((filter) => {
          const qs = new URLSearchParams();
          if (filter !== "all") qs.set("status", filter);
          if (legalEntityId) qs.set("legalEntityId", legalEntityId);
          const href = qs.toString() ? `/admin/payouts?${qs.toString()}` : "/admin/payouts";
          const active = filter === "all" ? !status : status === filter;
          return (
            <Link
              key={filter}
              href={href}
              className={`shrink-0 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
                active
                  ? "bg-primary text-on-primary ring-primary"
                  : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
              }`}
            >
              {filter.replace("_", " ")}
            </Link>
          );
        })}
      </nav>

      {payouts.length === 0 && !loadError ? (
        <EmptyState
          title="No payouts found"
          description="Run settlement for a legal entity once captured payments are ready."
        />
      ) : null}

      <ul className="space-y-3">
        {payouts.map((payout) => (
          <li key={payout.id}>
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-all font-heading text-lg">{payout.id}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(
                          payout.status,
                        )}`}
                      >
                        {payout.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-on-surface-variant">
                      Entity {payout.legalEntityId}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Period {formatDate(payout.periodStart)} → {formatDate(payout.periodEnd)} ·
                      Created {formatDate(payout.createdAt)}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-wide text-on-surface-variant">Net</p>
                    <p className="text-xl font-semibold">
                      {formatMoney(payout.netAmount, payout.currency)}
                    </p>
                  </div>
                </div>

                <dl className="grid gap-3 rounded-md bg-surface-container-low p-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-on-surface-variant">Gross</dt>
                    <dd className="font-medium">
                      {formatMoney(payout.grossAmount, payout.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Platform fee</dt>
                    <dd className="font-medium">
                      {formatMoney(payout.platformFee, payout.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Stripe fee</dt>
                    <dd className="font-medium">
                      {formatMoney(payout.stripeFee, payout.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Transfer</dt>
                    <dd className="break-all font-medium">{payout.stripeTransferId ?? "—"}</dd>
                  </div>
                </dl>

                {payout.failureReason ? (
                  <Alert variant="destructive">
                    <AlertTitle>Stripe transfer issue</AlertTitle>
                    <AlertDescription>{payout.failureReason}</AlertDescription>
                  </Alert>
                ) : null}

                {payout.status === "clawback_pending" ? (
                  <Alert variant="destructive">
                    <AlertTitle>Manual reconciliation required</AlertTitle>
                    <AlertDescription>
                      This payout has a negative net amount and cannot be sent through Stripe
                      Connect. Finance must recover the funds via transfer reversal, next-period
                      offset, or direct repayment before closing the case.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {payout.statementGenerationError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Statement PDF unavailable</AlertTitle>
                    <AlertDescription>{payout.statementGenerationError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <form
                    action={addPayoutAdjustmentAction}
                    className="space-y-3 rounded-md border p-3"
                  >
                    <input type="hidden" name="payoutId" value={payout.id} />
                    <h3 className="font-label text-sm font-semibold uppercase tracking-wide">
                      Add adjustment
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                      <label className="block space-y-1 text-sm">
                        <span>Amount</span>
                        <input
                          name="amount"
                          required
                          placeholder="-25.00"
                          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
                        />
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span>Note</span>
                        <input
                          name="note"
                          required
                          minLength={10}
                          placeholder="Reason for adjustment"
                          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={
                        payout.status === "paid" ||
                        payout.status === "failed" ||
                        payout.status === "reversed" ||
                        payout.status === "clawback_pending"
                      }
                      className="rounded-md border border-outline-variant px-4 py-2 font-label text-sm font-semibold disabled:opacity-50"
                    >
                      Add adjustment
                    </button>
                  </form>

                  <form action={markPayoutPaidAction} className="space-y-3 rounded-md border p-3">
                    <input type="hidden" name="payoutId" value={payout.id} />
                    <h3 className="font-label text-sm font-semibold uppercase tracking-wide">
                      Mark paid
                    </h3>
                    <label className="block space-y-1 text-sm">
                      <span>Stripe transfer ID</span>
                      <input
                        name="stripeTransferId"
                        required
                        defaultValue={payout.stripeTransferId ?? ""}
                        placeholder="tr_..."
                        className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={
                        payout.status === "paid" ||
                        payout.status === "failed" ||
                        payout.status === "reversed" ||
                        payout.status === "clawback_pending"
                      }
                      className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary disabled:opacity-50"
                    >
                      Mark paid
                    </button>
                  </form>
                </div>

                <AdminPayoutReverseButton payoutId={payout.id} status={payout.status} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-on-surface-variant">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

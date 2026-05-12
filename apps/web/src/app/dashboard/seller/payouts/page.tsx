import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { getPayoutStatusView } from "@/lib/presenters/payment-status";
import type { Payout } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { redirect } from "next/navigation";

type PendingPreview = {
  pendingGross: string;
  pendingPlatformFee: string;
  pendingNet: string;
  paymentCount: number;
  currency: string;
};

function formatMoney(amount: string, currency: string): string {
  const value = Number.parseFloat(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value);
}

export default async function SellerPayoutsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/seller/payouts",
  });
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);
  if (!acting) redirect("/dashboard");

  const headers = { [X_LEGAL_ENTITY_ID_HEADER]: acting.id };
  const [listRes, previewRes] = await Promise.all([
    authedServerFetch("/payouts", { headers, cache: "no-store" }),
    authedServerFetch("/payouts/preview-next", { headers, cache: "no-store" }),
  ]);

  let payouts: Payout[] = [];
  let listError: string | null = null;
  if (listRes.ok) {
    const body = (await listRes.json()) as { data: Payout[] };
    payouts = body.data;
  } else {
    listError = `Could not load payouts (status ${listRes.status}).`;
  }

  let preview: PendingPreview | null = null;
  if (previewRes.ok) {
    const body = (await previewRes.json()) as { data: PendingPreview };
    preview = body.data;
  }

  return (
    <DashboardPage>
      <PageHeader
        title="Sold & payouts"
        description="Hammer prices, buyer premiums collected by LAX, seller commissions, and adjustments roll into each settlement batch."
        className="border-0 pb-0"
      />

      {listError && (
        <Alert variant="destructive" className="rounded-xl border-error/40 shadow-sm">
          <AlertTitle>Could not load</AlertTitle>
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}

      {preview && (
        <Card className="border-outline-variant/15 shadow-sm">
          <CardContent className="space-y-2 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
              Next payout (preview)
            </h2>
            {preview.paymentCount === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No captured payments are awaiting settlement.
              </p>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-on-surface-variant">Gross</dt>
                  <dd className="font-medium tabular-nums text-on-surface">
                    {formatMoney(preview.pendingGross, preview.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Platform fees</dt>
                  <dd className="font-medium tabular-nums text-on-surface">
                    {formatMoney(preview.pendingPlatformFee, preview.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Net</dt>
                  <dd className="font-semibold tabular-nums text-on-surface">
                    {formatMoney(preview.pendingNet, preview.currency)}
                  </dd>
                </div>
                <div className="sm:col-span-3">
                  <p className="text-xs text-on-surface-variant">
                    Across {preview.paymentCount} captured payment
                    {preview.paymentCount === 1 ? "" : "s"}. Net excludes Stripe transfer fees,
                    which are reconciled when the payout is initiated.
                  </p>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      {payouts.length === 0 ? (
        <EmptyState
          title="No payouts yet"
          description="When LAX processes a settlement batch for your sales, the payout statement will appear here with line-by-line breakdowns."
        />
      ) : (
        <ul className="space-y-3">
          {payouts.map((p) => {
            const statusView = getPayoutStatusView(p.status);
            return (
              <li key={p.id}>
                <Card className="border-outline-variant/15 shadow-sm transition-colors hover:border-primary/20">
                  <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                    <div>
                      <p className="font-medium">
                        {new Date(p.periodStart).toLocaleDateString("en-GB")} →{" "}
                        {new Date(p.periodEnd).toLocaleDateString("en-GB")}
                      </p>
                      <p className="text-xs tabular-nums text-on-surface-variant">
                        Gross {formatMoney(p.grossAmount, p.currency)} · Fees{" "}
                        {formatMoney(p.platformFee, p.currency)}
                        {Number.parseFloat(p.stripeFee) > 0
                          ? ` + ${formatMoney(p.stripeFee, p.currency)} transfer`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right text-base font-semibold tabular-nums text-on-surface">
                      {formatMoney(p.netAmount, p.currency)}
                    </div>
                    <div className="flex items-center justify-end">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusView.badgeClassName}`}
                      >
                        {statusView.label}
                      </span>
                    </div>
                    <div className="flex justify-end sm:justify-center">
                      <a
                        href={`/dashboard/legal-entities/${encodeURIComponent(acting.id)}/payouts/${encodeURIComponent(p.id)}/statement`}
                        className="text-xs font-semibold text-primary underline underline-offset-2"
                      >
                        Statement PDF
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPage>
  );
}

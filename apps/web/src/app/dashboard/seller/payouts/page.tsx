import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PayoutsExportButton } from "@/components/dashboard/payouts-export-button";
import { DashboardEmptyState, DashboardErrorAlert } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SellerPayoutPendingPreview } from "@/lib/data/http/seller-payouts.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { getPayoutStatusView } from "@/lib/presenters/payment-status";
import type { Payout } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import { redirect } from "next/navigation";

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

  const c = await getServerDataContainer();
  const [listRes, previewRes] = await Promise.all([
    c.sellerPayouts.listForLegalEntity(acting.id),
    c.sellerPayouts.previewNextForLegalEntity(acting.id),
  ]);

  let payouts: Payout[] = [];
  let listError: string | null = null;
  if (listRes.ok) {
    payouts = listRes.payouts;
  } else {
    const messages: Record<string, string> = {
      unauthorized: "Your session has expired. Please sign in again.",
      forbidden: "You do not have permission to view payouts for this entity.",
      server_error: "Could not load payouts. Please try again later.",
    };
    listError = messages[listRes.error] ?? "Could not load payouts.";
  }

  let preview: SellerPayoutPendingPreview | null = null;
  if (previewRes.ok) {
    preview = previewRes.data;
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta="Selling"
        title="Sold & payouts"
        description="Hammer prices, buyer premiums collected by LAX, seller commissions, and adjustments roll into each settlement batch."
        actions={
          payouts.length > 0 ? (
            <PayoutsExportButton
              rows={payouts.map((p) => ({
                id: p.id,
                periodStart: new Date(p.periodStart).toISOString(),
                periodEnd: new Date(p.periodEnd).toISOString(),
                grossAmount: p.grossAmount,
                platformFee: p.platformFee,
                stripeFee: p.stripeFee,
                netAmount: p.netAmount,
                currency: p.currency,
                status: p.status,
              }))}
            />
          ) : null
        }
      />

      {listError && <DashboardErrorAlert title="Could not load payouts" message={listError} />}

      {preview && (
        <Surface variant="section" padding="md" className="space-y-2">
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
                  {preview.paymentCount === 1 ? "" : "s"}. Net excludes Stripe transfer fees, which
                  are reconciled when the payout is initiated.
                </p>
              </div>
            </dl>
          )}
        </Surface>
      )}

      {payouts.length === 0 && !listError ? (
        <DashboardEmptyState
          title="No payouts yet"
          description="When LAX processes a settlement batch for your sales, the payout statement will appear here with line-by-line breakdowns."
        />
      ) : payouts.length > 0 ? (
        <ul className="space-y-3">
          {payouts.map((p) => {
            const statusView = getPayoutStatusView(p.status);
            return (
              <li key={p.id}>
                <Surface
                  variant="section"
                  padding="md"
                  interactive
                  className="grid gap-3 text-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                >
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
                </Surface>
              </li>
            );
          })}
        </ul>
      ) : null}
    </DashboardPage>
  );
}

import { AppScreen } from "@/components/dashboard/dashboard-page";
import {
  captureManualReviewPaymentAction,
  refundManualReviewPaymentAction,
} from "@/lib/admin/payment.actions";
import { getAdminManualReviewPayments } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";

function formatMoney(amount: string, currency: string): string {
  const value = Number.parseFloat(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
}

function formatDate(input: string | null): string {
  if (!input) return "Unknown";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ManualReviewPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const sp = await searchParams;
  const success = sp.success ? decodeURIComponent(sp.success) : null;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  let payments: Awaited<ReturnType<typeof getAdminManualReviewPayments>> = [];
  let loadError: string | null = null;
  try {
    payments = await getAdminManualReviewPayments();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load manual review payments.";
  }

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Manual Payment Review"
        description="Winning payments paused because the seller entity was archived before capture."
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

      {payments.length === 0 && !loadError ? (
        <EmptyState
          title="No manual review payments"
          description="Archived-seller winning payments will appear here before capture."
        />
      ) : null}

      <ul className="space-y-3">
        {payments.map((payment) => {
          const lotReference =
            payment.lotNumber == null ? payment.lotId : `Lot ${payment.lotNumber}`;
          return (
            <li key={payment.paymentId}>
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <h2 className="font-heading text-lg">{payment.lotTitle}</h2>
                      <p className="text-sm text-on-surface-variant">{lotReference}</p>
                      <p className="mt-2 break-all text-xs text-on-surface-variant">
                        Payment {payment.paymentId}
                      </p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-xs uppercase tracking-wide text-on-surface-variant">
                        Winning amount
                      </p>
                      <p className="text-xl font-semibold">
                        {formatMoney(payment.amount, payment.currency)}
                      </p>
                    </div>
                  </div>

                  <dl className="grid gap-3 rounded-md bg-surface-container-low p-3 text-sm md:grid-cols-3">
                    <div>
                      <dt className="text-on-surface-variant">Winner</dt>
                      <dd className="break-all font-medium">{payment.winnerEmail}</dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">Archived seller</dt>
                      <dd className="font-medium">{payment.sellerDisplayName}</dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">Archived at</dt>
                      <dd className="font-medium">
                        {formatDate(payment.archiveTimestamp ?? payment.sellerArchivedAt)}
                      </dd>
                    </div>
                  </dl>

                  <Alert>
                    <AlertTitle>Archive reason</AlertTitle>
                    <AlertDescription>
                      {payment.archiveReason ?? "No reason recorded."}
                    </AlertDescription>
                  </Alert>

                  <div className="flex flex-wrap gap-3">
                    <form action={captureManualReviewPaymentAction}>
                      <input type="hidden" name="paymentId" value={payment.paymentId} />
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary"
                      >
                        Capture and process
                      </button>
                    </form>
                    <form action={refundManualReviewPaymentAction}>
                      <input type="hidden" name="paymentId" value={payment.paymentId} />
                      <button
                        type="submit"
                        className="rounded-md border border-outline-variant px-4 py-2 font-label text-sm font-semibold text-error"
                      >
                        Refund buyer
                      </button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </AppScreen>
  );
}

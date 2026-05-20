import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { PayoutSettlementForm } from "@/components/admin/payout-settlement-form";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

export default async function PayoutSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const sp = await searchParams;
  const success = sp.success ? decodeURIComponent(sp.success) : null;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <AdminPanelPage
      title="Run settlement"
      description="Create a payout from captured payments for one legal entity on demand."
      actions={
        <Link
          href="/admin/payouts"
          className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Back to payouts
        </Link>
      }
    >
      {success ? (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Settlement failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Surface variant="card">
        <div className="space-y-4 p-4">
          <p className="text-sm text-on-surface-variant">
            When the worker and API share <code className="text-xs">CRON_INTERNAL_SECRET</code>, a
            daily job also settles every eligible legal entity automatically.
          </p>
          <PayoutSettlementForm />
        </div>
      </Surface>
    </AdminPanelPage>
  );
}

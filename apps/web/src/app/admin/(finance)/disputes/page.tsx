import { AppScreen } from "@/components/dashboard/dashboard-page";
import { getAdminFinanceDisputeDomainEvents } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default async function AdminDisputesPage() {
  let rows: Awaited<ReturnType<typeof getAdminFinanceDisputeDomainEvents>> = [];
  let loadError: string | null = null;
  try {
    rows = await getAdminFinanceDisputeDomainEvents({ limit: 200 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load dispute events.";
  }

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Payment disputes"
        description="Stripe dispute-related domain events (opened, funds withdrawn, closed). Payloads are redacted per audit policy."
      />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <p className="font-body text-sm text-on-surface-variant">
        For capture/refund actions use{" "}
        <Link href="/admin/payments" className="text-primary underline">
          Payments
        </Link>
        .
      </p>

      {rows.length === 0 && !loadError ? (
        <p className="font-body text-sm text-on-surface-variant">No dispute events recorded yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-outline-variant/20">
          <table className="w-full min-w-[720px] border-collapse text-left font-body text-sm">
            <thead className="bg-surface-container-low/80 font-label text-xs uppercase tracking-widest text-on-surface-variant">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Aggregate</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/15">
                  <td className="whitespace-nowrap px-3 py-2 text-on-surface-variant">
                    {r.occurredAt.toISOString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.eventType}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.aggregateType}:{r.aggregateId.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.actorUserId ?? "—"}</td>
                  <td
                    className="max-w-md truncate px-3 py-2 font-mono text-xs"
                    title={JSON.stringify(r.payload)}
                  >
                    {JSON.stringify(r.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AppScreen>
  );
}

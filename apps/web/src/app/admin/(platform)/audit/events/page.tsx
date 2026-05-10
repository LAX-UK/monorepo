import { getAdminDomainEvents } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ prefix?: string; limit?: string }>;
};

export default async function AdminAuditEventsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const prefix = typeof sp.prefix === "string" ? sp.prefix : "";
  const limit = Math.min(500, Math.max(1, Number.parseInt(sp.limit ?? "100", 10) || 100));

  let rows: Awaited<ReturnType<typeof getAdminDomainEvents>> = [];
  let loadError: string | null = null;
  try {
    const params: { limit: number; eventTypePrefix?: string } = { limit };
    const p = prefix.trim();
    if (p) params.eventTypePrefix = p;
    rows = await getAdminDomainEvents(params);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load domain events.";
  }

  const examples = ["payment.", "lot.", "legal_entity.", "payout."];

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Domain events"
        description="Recent audit trail (PII redacted server-side). Narrow by event type prefix; export CSV/JSON from the API for deeper analysis."
      />

      <div className="flex flex-wrap items-center gap-3 font-body text-sm">
        <span className="text-on-surface-variant">Quick filters:</span>
        {examples.map((p) => (
          <Link
            key={p}
            href={`/admin/audit/events?prefix=${encodeURIComponent(p)}`}
            className="rounded-full bg-surface-container-low px-3 py-1 font-mono text-xs ring-1 ring-outline-variant/20 hover:bg-surface-container-high/80"
          >
            {p}
          </Link>
        ))}
        <Link
          href="/admin/audit/events"
          className="text-primary underline decoration-primary/40 underline-offset-4"
        >
          Clear
        </Link>
        <span className="ml-auto max-w-sm text-right font-body text-xs text-on-surface-variant">
          Bulk export: authenticated GET{" "}
          <span className="font-mono">/admin/audit/domain-events/export</span>
        </span>
      </div>

      {prefix ? (
        <p className="font-mono text-xs text-on-surface-variant">
          Prefix: <span className="text-on-surface">{prefix}</span> · limit {limit}
        </p>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 && !loadError ? (
        <p className="font-body text-sm text-on-surface-variant">No rows for this filter.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-outline-variant/20">
          <table className="w-full min-w-[800px] border-collapse text-left font-body text-sm">
            <thead className="bg-surface-container-low/80 font-label text-xs uppercase tracking-widest text-on-surface-variant">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Aggregate</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Entity</th>
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
                  <td className="px-3 py-2 font-mono text-xs">{r.actingLegalEntityId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

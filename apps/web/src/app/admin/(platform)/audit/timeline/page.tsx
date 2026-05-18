import { AdminListPage } from "@/components/admin/admin-list-page";
import { auditTimelineListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

export default async function AdminAuditTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{
    aggregateType?: string;
    aggregateId?: string;
    limit?: string;
    offset?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = auditTimelineListController.parseQuery(sp);
  const hasPair = Boolean(query.aggregateType && query.aggregateId);

  let rows: Awaited<ReturnType<typeof auditTimelineListController.fetch>>["rows"] = [];
  let loadError: string | null = null;
  if (hasPair) {
    try {
      const result = await auditTimelineListController.fetch(query);
      rows = result.rows;
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Could not load domain events.";
    }
  }

  const toolbarEnd = (
    <Link
      href="/admin/audit/events"
      className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
    >
      ← Domain events feed
    </Link>
  );

  const filters = (
    <form
      method="get"
      action="/admin/audit/timeline"
      className="grid max-w-3xl gap-4 rounded-lg border border-outline-variant/25 bg-surface-container-low/40 p-4 sm:grid-cols-[1fr_1fr_auto]"
    >
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-on-surface">Aggregate type</span>
        <input
          name="aggregateType"
          defaultValue={query.aggregateType ?? ""}
          placeholder="e.g. lot, payment, legal_entity"
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 font-mono text-xs"
          autoComplete="off"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-on-surface">Aggregate id</span>
        <input
          name="aggregateId"
          defaultValue={query.aggregateId ?? ""}
          placeholder="UUID or opaque id"
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 font-mono text-xs"
          autoComplete="off"
        />
      </label>
      <label className="block space-y-1 text-sm sm:col-span-1">
        <span className="font-medium text-on-surface">Limit</span>
        <input
          name="limit"
          type="number"
          min={1}
          max={500}
          defaultValue={query.limit}
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 font-mono text-xs"
        />
      </label>
      <div className="sm:col-span-3">
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary"
        >
          Load timeline
        </button>
      </div>
    </form>
  );

  const errorAlert =
    error || loadError ? (
      <Alert variant="destructive">
        <AlertTitle>Could not load</AlertTitle>
        <AlertDescription>{loadError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const emptyNoPair = !hasPair ? (
    <p className="font-body text-sm text-on-surface-variant">
      Enter both aggregate type and id, then submit. Example: type{" "}
      <span className="font-mono">lot</span> with a lot UUID from the catalogue.
    </p>
  ) : null;

  const meta =
    hasPair && query.aggregateType && query.aggregateId ? (
      <div className="space-y-2">
        <p className="font-mono text-xs text-on-surface-variant">
          <span className="text-on-surface">{query.aggregateType}</span> ·{" "}
          <span className="break-all text-on-surface">{query.aggregateId}</span> · oldest first ·
          limit {query.limit} · {rows.length} row{rows.length === 1 ? "" : "s"}
        </p>
        <p className="flex flex-wrap gap-3 font-body text-sm">
          <a
            className="text-primary underline decoration-primary/40 underline-offset-4"
            href={`/admin/audit/timeline/download?${new URLSearchParams({
              aggregateType: query.aggregateType,
              aggregateId: query.aggregateId,
              format: "csv",
              limit: String(query.limit),
            }).toString()}`}
          >
            Download CSV
          </a>
          <a
            className="text-primary underline decoration-primary/40 underline-offset-4"
            href={`/admin/audit/timeline/download?${new URLSearchParams({
              aggregateType: query.aggregateType,
              aggregateId: query.aggregateId,
              format: "json",
              limit: String(query.limit),
            }).toString()}`}
          >
            Download JSON
          </a>
        </p>
      </div>
    ) : null;

  const emptyNoRows =
    hasPair && !loadError && rows.length === 0 ? (
      <p className="font-body text-sm text-on-surface-variant">
        No domain events for this aggregate.
      </p>
    ) : null;

  const timeline =
    rows.length > 0 ? (
      <div className="relative border-l-2 border-outline-variant/40 pl-8">
        <ul className="space-y-8">
          {rows.map((r) => (
            <li key={r.id} className="relative">
              <span
                className="absolute -left-[25px] top-1.5 size-3 rounded-full bg-primary ring-4 ring-surface"
                aria-hidden
              />
              <time className="block font-mono text-xs text-on-surface-variant">
                {r.occurredAt.toISOString()}
              </time>
              <p className="mt-1 font-mono text-sm font-semibold text-on-surface">{r.eventType}</p>
              <p className="mt-1 font-mono text-xs text-on-surface-variant">
                actor {r.actorUserId ?? "—"} · entity {r.actingLegalEntityId ?? "—"}
              </p>
              <details className="mt-2 rounded-md border border-outline-variant/30 bg-surface-container-low/50 p-3">
                <summary className="cursor-pointer font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
                  Payload (redacted)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-on-surface">
                  {JSON.stringify(r.payload, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const pagination =
    hasPair && !loadError && (query.offset > 0 || rows.length === query.limit) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/audit/timeline", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          rows.length === query.limit
            ? buildListHref("/admin/audit/timeline", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Audit timeline"
      description="Chronological domain events for a single aggregate (PII redacted the same way as the main feed). Use this to reconstruct what happened to a lot, payment, legal entity, etc."
      toolbarEnd={toolbarEnd}
      filters={filters}
      meta={meta}
      errorAlert={errorAlert}
      view={timeline}
      empty={
        <>
          {emptyNoPair}
          {emptyNoRows}
        </>
      }
      pagination={pagination}
    />
  );
}

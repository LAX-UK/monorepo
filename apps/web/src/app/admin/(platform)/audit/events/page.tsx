import { AdminAuditDomainEventsBoard } from "@/components/admin/admin-audit-domain-events-board";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { auditDomainEventsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

const examples = ["payment.", "lot.", "legal_entity.", "payout."];

type Props = {
  searchParams: Promise<{ prefix?: string; limit?: string; offset?: string; error?: string }>;
};

export default async function AdminAuditEventsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = auditDomainEventsListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof auditDomainEventsListController.fetch>>["rows"] = [];
  let loadError: string | null = null;
  try {
    const result = await auditDomainEventsListController.fetch(query);
    rows = result.rows;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load domain events.";
  }

  const quickFilters = (
    <div className="flex flex-wrap items-center gap-3 font-body text-sm">
      <span className="text-on-surface-variant">Quick filters:</span>
      {examples.map((p) => (
        <Link
          key={p}
          href={buildListHref("/admin/audit/events", sp, { prefix: p, offset: 0 })}
          className="rounded-full bg-surface-container-low px-3 py-1 font-mono text-xs ring-1 ring-outline-variant/20 hover:bg-surface-container-high/80"
        >
          {p}
        </Link>
      ))}
      <Link
        href="/admin/audit/timeline"
        className="rounded-full bg-surface-container-low px-3 py-1 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 ring-outline-variant/20 hover:bg-surface-container-high/80"
      >
        Aggregate timeline
      </Link>
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
  );

  const filters = (
    <div className="flex w-full flex-col gap-4">
      {quickFilters}
      <form method="get" action="/admin/audit/events" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Event type prefix
          </span>
          <input
            name="prefix"
            type="search"
            defaultValue={query.eventTypePrefix ?? ""}
            placeholder="e.g. payment."
            className="h-10 w-56 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Limit
          </span>
          <input
            name="limit"
            type="number"
            min={1}
            max={500}
            defaultValue={query.limit}
            className="h-10 w-24 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 font-body text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </label>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-md bg-primary px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary transition-colors hover:bg-primary/90"
        >
          Apply
        </button>
      </form>
    </div>
  );

  const errorAlert =
    error || loadError ? (
      <Alert variant="destructive">
        <AlertTitle>Could not load</AlertTitle>
        <AlertDescription>{loadError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const prefixMeta =
    query.eventTypePrefix != null && query.eventTypePrefix !== "" ? (
      <p className="font-mono text-xs text-on-surface-variant">
        Prefix: <span className="text-on-surface">{query.eventTypePrefix}</span> · limit{" "}
        {query.limit}
      </p>
    ) : null;

  const empty =
    !loadError && rows.length === 0 ? (
      <p className="font-body text-sm text-on-surface-variant">No rows for this filter.</p>
    ) : null;

  const view = !loadError && rows.length > 0 ? <AdminAuditDomainEventsBoard rows={rows} /> : null;

  const pagination =
    !loadError && (query.offset > 0 || rows.length === query.limit) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/audit/events", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          rows.length === query.limit
            ? buildListHref("/admin/audit/events", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Domain events"
      description="Recent audit trail (PII redacted server-side). Narrow by event type prefix; export CSV/JSON from the API for deeper analysis."
      errorAlert={errorAlert}
      meta={prefixMeta}
      filters={filters}
      view={view}
      empty={empty}
      pagination={pagination}
    />
  );
}

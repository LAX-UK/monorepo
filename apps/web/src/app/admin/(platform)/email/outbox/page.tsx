import { AdminEmailOutboxBoard } from "@/components/admin/admin-email-outbox-board";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { emailOutboxListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { AdminEmailOutboxRow } from "@/lib/data/http/admin.server";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Mail } from "lucide-react";

const statusChips: (AdminEmailOutboxRow["status"] | "all")[] = [
  "all",
  "pending",
  "sending",
  "sent",
  "failed",
  "suppressed",
];

export default async function AdminEmailOutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; limit?: string; offset?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = emailOutboxListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof emailOutboxListController.fetch>>["rows"] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await emailOutboxListController.fetch(query);
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load outbox.";
  }

  const chips = (
    <FilterChipRow
      label="Filter by email status"
      chips={statusChips.map((item) => ({
        id: item,
        label: item,
        href: buildListHref("/admin/email/outbox", sp, {
          status: item === "all" ? "" : item,
          offset: 0,
        }),
        active:
          (item === "all" && query.status === undefined) ||
          (item !== "all" && item === query.status),
      }))}
    />
  );

  const errorAlert =
    error || loadError ? (
      <Alert variant="destructive">
        <AlertTitle>Could not load</AlertTitle>
        <AlertDescription>{loadError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const empty =
    !loadError && total === 0 ? (
      <EmptyState
        icon={<Mail aria-hidden />}
        title="No email rows"
        description="Transactional email sends will appear here."
      />
    ) : !loadError && rows.length === 0 ? (
      <p className="font-body text-sm text-on-surface-variant">No rows on this page.</p>
    ) : null;

  const view = !loadError && rows.length > 0 ? <AdminEmailOutboxBoard rows={rows} /> : null;

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        total={total}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/email/outbox", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/email/outbox", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Email outbox"
      description="Recent transactional email sends."
      errorAlert={errorAlert}
      chips={chips}
      view={view}
      empty={empty}
      pagination={pagination}
    />
  );
}

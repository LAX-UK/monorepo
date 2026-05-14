import { AdminListPage } from "@/components/admin/admin-list-page";
import { EmailSuppressionsBoard } from "@/components/admin/email-suppressions-board";
import { emailSuppressionsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { MailX } from "lucide-react";

export default async function AdminEmailSuppressionsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; offset?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = emailSuppressionsListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof emailSuppressionsListController.fetch>>["rows"] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await emailSuppressionsListController.fetch(query);
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load suppressions.";
  }

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
        icon={<MailX aria-hidden />}
        title="No suppressed addresses"
        description="Bounces, complaints, and unsubscribes will appear here."
      />
    ) : !loadError && rows.length === 0 ? (
      <p className="font-body text-sm text-on-surface-variant">No rows on this page.</p>
    ) : null;

  const view = !loadError && rows.length > 0 ? <EmailSuppressionsBoard rows={rows} /> : null;

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        total={total}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/email/suppressions", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/email/suppressions", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Email suppressions"
      description="Addresses blocked from outbound email."
      errorAlert={errorAlert}
      view={view}
      empty={empty}
      pagination={pagination}
    />
  );
}

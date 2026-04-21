import {
  type AdminSubmissionTableRow,
  AdminSubmissionsDataTable,
} from "@/components/admin/admin-submissions-data-table";
import { TableScroll } from "@/components/ui/table-scroll";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import type { ItemSubmissionStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Input } from "@auction/ui/components/input";
import { Toolbar } from "@auction/ui/components/toolbar";
import Link from "next/link";

function adminSubmissionsHref(parts: { status?: ItemSubmissionStatus; q?: string }): string {
  const p = new URLSearchParams();
  if (parts.status) p.set("status", parts.status);
  if (parts.q != null && parts.q !== "") p.set("q", parts.q);
  const s = p.toString();
  return s ? `/admin/submissions?${s}` : "/admin/submissions";
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const initialQ = (sp.q ?? "").trim().slice(0, 200);
  const status =
    sp.status === "draft" ||
    sp.status === "submitted" ||
    sp.status === "under_review" ||
    sp.status === "approved" ||
    sp.status === "rejected" ||
    sp.status === "withdrawn" ||
    sp.status === "converted"
      ? (sp.status as ItemSubmissionStatus)
      : undefined;

  let rows: Awaited<ReturnType<typeof getAdminSubmissions>> = [];
  let loadError: string | null = null;
  try {
    rows = await getAdminSubmissions(
      status !== undefined ? { status, limit: 100, offset: 0 } : { limit: 100, offset: 0 },
    );
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load submissions.";
  }

  const qLower = initialQ.toLowerCase();
  const rowsAfterTitle =
    initialQ.length === 0 ? rows : rows.filter((s) => s.title.toLowerCase().includes(qLower));

  const submissionRows: AdminSubmissionTableRow[] = rowsAfterTitle.map((s) => ({
    id: s.id,
    title: s.title,
    sellerPreview: `Seller ${s.sellerId.slice(0, 8)}…`,
    status: s.status,
    createdAtLabel: s.createdAt.toLocaleString(),
  }));

  const clearTitleHref = adminSubmissionsHref({
    ...(status != null ? { status } : {}),
  });

  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
      <DisplayHeading as="h1" className="text-4xl text-brand-900 dark:text-on-surface">
        Submissions
      </DisplayHeading>
      <p className="font-body text-sm text-on-surface-variant">
        Review seller intake. Start review on submitted items, then approve (creates a draft lot) or
        reject with a clear reason.
      </p>

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load submissions</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!loadError ? (
        <Toolbar
          className="flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
          filters={
            <form
              method="get"
              className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="grid min-w-[200px] flex-1 gap-1">
                <label
                  htmlFor="admin-submissions-status"
                  className="font-label text-xs uppercase tracking-widest text-secondary"
                >
                  Status
                </label>
                <select
                  id="admin-submissions-status"
                  name="status"
                  defaultValue={status ?? ""}
                  className="rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
                >
                  <option value="">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under review</option>
                  <option value="converted">Converted</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="grid min-w-0 flex-1 gap-1 sm:max-w-md">
                <label
                  htmlFor="admin-submissions-q"
                  className="font-label text-xs uppercase tracking-widest text-secondary"
                >
                  Title contains
                </label>
                <Input
                  id="admin-submissions-q"
                  name="q"
                  defaultValue={initialQ}
                  placeholder="Filter loaded rows…"
                  className="bg-surface-container-low"
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                Apply filters
              </Button>
            </form>
          }
        />
      ) : null}

      {!loadError && rows.length === 0 ? (
        <EmptyState
          title="No submissions"
          description="Nothing matches this filter yet, or the intake queue is empty."
        />
      ) : null}

      {!loadError && rows.length > 0 && submissionRows.length === 0 ? (
        <EmptyState
          title="No title matches"
          description="Nothing in the current list matches that title. Try another phrase or clear the title filter."
          action={
            <Button variant="secondary" asChild>
              <Link href={clearTitleHref}>Clear title search</Link>
            </Button>
          }
        />
      ) : null}

      {!loadError && submissionRows.length > 0 ? (
        <TableScroll>
          <AdminSubmissionsDataTable rows={submissionRows} />
        </TableScroll>
      ) : null}
    </div>
  );
}

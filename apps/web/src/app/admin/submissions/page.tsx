import {
  type AdminSubmissionTableRow,
  AdminSubmissionsDataTable,
} from "@/components/admin/admin-submissions-data-table";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import type { ItemSubmissionStatus } from "@auction/types";

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
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

  const submissionRows: AdminSubmissionTableRow[] = rows.map((s) => ({
    id: s.id,
    title: s.title,
    sellerPreview: `Seller ${s.sellerId.slice(0, 8)}…`,
    status: s.status,
    createdAtLabel: s.createdAt.toLocaleString(),
  }));

  return (
    <div className="max-w-6xl space-y-8">
      <DisplayHeading as="h1" className="text-4xl">
        Submissions
      </DisplayHeading>
      <p className="font-body text-sm text-on-surface-variant">
        Review seller intake. Start review on submitted items, then approve (creates a draft lot) or
        reject with a clear reason.
      </p>
      {(error || loadError) && (
        <p className="text-sm text-error" role="alert">
          {loadError ?? error}
        </p>
      )}
      <form className="flex flex-wrap gap-2" method="get">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="draft">Draft</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-outline-variant/20 px-4 py-2 font-label text-xs uppercase tracking-widest text-primary"
        >
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-on-surface-variant">No submissions.</p>
      ) : (
        <AdminSubmissionsDataTable rows={submissionRows} />
      )}
    </div>
  );
}

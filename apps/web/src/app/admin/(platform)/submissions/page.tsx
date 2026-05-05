import { AdminSubmissionsBoard } from "@/components/admin/admin-submissions-board";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { AdminSubmissionsTitleFilterForm } from "@/components/admin/admin-submissions-title-filter-form";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import type { ItemSubmissionStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

function adminSubmissionsHref(parts: { status?: ItemSubmissionStatus; q?: string }): string {
  const p = new URLSearchParams();
  if (parts.status) p.set("status", parts.status);
  if (parts.q != null && parts.q !== "") p.set("q", parts.q);
  const s = p.toString();
  return s ? `/admin/submissions?${s}` : "/admin/submissions";
}

const statusChips: { value: ItemSubmissionStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "converted", label: "Converted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "draft", label: "Draft" },
];

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

  const filterForm = (
    <div className="flex w-full flex-col gap-4">
      <div className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {statusChips.map((chip) => {
          const href = adminSubmissionsHref({
            ...(chip.value ? { status: chip.value as ItemSubmissionStatus } : {}),
            ...(initialQ ? { q: initialQ } : {}),
          });
          const active =
            (chip.value === "" && status === undefined) ||
            (chip.value !== "" && chip.value === status);
          return (
            <Link
              key={chip.label}
              href={href}
              className={`shrink-0 snap-start rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
                active
                  ? "bg-primary text-on-primary ring-primary"
                  : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
              }`}
            >
              {chip.label}
            </Link>
          );
        })}
      </div>
      <AdminSubmissionsTitleFilterForm initialQ={initialQ} status={status} />
    </div>
  );

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Submissions"
        description="Review seller intake. Start review on submitted items, then approve (creates a draft lot) or reject with a clear reason."
      />

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load submissions</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
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
        <AdminSubmissionsBoard rows={submissionRows} filterForm={filterForm} />
      ) : null}
    </div>
  );
}

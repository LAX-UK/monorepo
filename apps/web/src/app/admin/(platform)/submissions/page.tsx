import { AdminSubmissionsBoard } from "@/components/admin/admin-submissions-board";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { AdminSubmissionsTitleFilterForm } from "@/components/admin/admin-submissions-title-filter-form";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { ResetFiltersLink } from "@/components/admin/reset-filters-link";
import { ShareFiltersButton } from "@/components/admin/share-filters-button";
import { AppScreen } from "@/components/dashboard/dashboard-page";
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
    rows = await getAdminSubmissions({
      ...(status !== undefined ? { status } : {}),
      ...(initialQ ? { q: initialQ } : {}),
      limit: 100,
      offset: 0,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load submissions.";
  }

  const submissionRows: AdminSubmissionTableRow[] = rows.map((s) => ({
    id: s.id,
    title: s.title,
    sellerPreview: `Seller ${(s.sellerId ?? s.legalEntityId ?? "").slice(0, 8)}…`,
    status: s.status,
    createdAtLabel: s.createdAt.toLocaleString(),
  }));

  const clearTitleHref = adminSubmissionsHref({
    ...(status != null ? { status } : {}),
  });

  const filterForm = (
    <div className="flex w-full flex-col gap-4">
      <FilterChipRow
        label="Filter by submission status"
        chips={statusChips.map((chip) => ({
          id: chip.value || "all",
          label: chip.label,
          href: adminSubmissionsHref({
            ...(chip.value ? { status: chip.value as ItemSubmissionStatus } : {}),
            ...(initialQ ? { q: initialQ } : {}),
          }),
          active:
            (chip.value === "" && status === undefined) ||
            (chip.value !== "" && chip.value === status),
        }))}
      />
      <AdminSubmissionsTitleFilterForm initialQ={initialQ} status={status} />
    </div>
  );

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Submissions"
        description="Review seller intake. Start review on submitted items, then approve (creates a draft lot) or reject with a clear reason."
        actions={
          <div className="flex flex-wrap gap-2">
            <ShareFiltersButton />
            <ResetFiltersLink active={Boolean(status || initialQ)} href="/admin/submissions" />
          </div>
        }
      />

      {error || loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load submissions</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!loadError && rows.length === 0 && !initialQ ? (
        <EmptyState
          title="No submissions"
          description="Nothing matches this filter yet, or the intake queue is empty."
        />
      ) : null}

      {!loadError && initialQ && rows.length === 0 ? (
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
    </AppScreen>
  );
}

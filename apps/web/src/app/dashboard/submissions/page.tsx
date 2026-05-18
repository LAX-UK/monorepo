import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardErrorAlert, DashboardSkeleton } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SubmissionsBoard } from "@/components/dashboard/submissions-board";
import { Button } from "@/components/ui/button";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
import type { SubmissionListFilterValues } from "@auction/validators";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function DashboardSubmissionsPage({
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

  const initialStatus: SubmissionListFilterValues["status"] = status ?? "all";

  const c = await getServerDataContainer();
  let rows: ItemSubmission[] = [];
  let allForCounts: ItemSubmission[] = [];
  let loadError: string | null = null;
  try {
    const [filtered, all] = await Promise.all([
      c.submissions.listMine(
        status !== undefined ? { status, limit: 50, offset: 0 } : { limit: 50, offset: 0 },
      ),
      c.submissions.listMine({ limit: 100, offset: 0 }),
    ]);
    rows = filtered;
    allForCounts = all;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load submissions.";
  }

  const statusCounts: Record<ItemSubmissionStatus | "all", number> = {
    all: allForCounts.length,
    draft: 0,
    submitted: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    withdrawn: 0,
    converted: 0,
  };
  for (const s of allForCounts) {
    statusCounts[s.status] += 1;
  }

  const mapped = rows.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    updatedAt: s.updatedAt.toISOString(),
  }));
  const qLower = initialQ.toLowerCase();
  const tableRows =
    initialQ.length === 0 ? mapped : mapped.filter((r) => r.title.toLowerCase().includes(qLower));

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta="Selling"
        title="Your submissions"
        description="Submit item details for specialist review. When approved, a draft lot is created for cataloguing and scheduling."
        actions={
          <Button variant="primary" asChild>
            <Link href="/dashboard/submissions/new">
              <Plus className="size-4" aria-hidden />
              New submission
            </Link>
          </Button>
        }
      />
      {error || loadError ? (
        <DashboardErrorAlert title="Could not load" message={loadError ?? error ?? ""}>
          <Button variant="secondary" asChild>
            <Link href="/dashboard/submissions">Try again</Link>
          </Button>
        </DashboardErrorAlert>
      ) : (
        <Suspense fallback={<DashboardSkeleton variant="list" />}>
          <SubmissionsBoard
            rows={tableRows}
            initialStatus={initialStatus}
            initialQ={initialQ}
            fetchedCount={mapped.length}
            statusCounts={statusCounts}
          />
        </Suspense>
      )}
    </DashboardPage>
  );
}

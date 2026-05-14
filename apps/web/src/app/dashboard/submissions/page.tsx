import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardErrorAlert, DashboardSkeleton } from "@/components/dashboard/primitives";
import { SubmissionsBoard } from "@/components/dashboard/submissions-board";
import { Button } from "@/components/ui/button";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SubmissionListFilterValues } from "@/lib/forms/submission/submission-form-schema";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
import { PageHeader } from "@auction/ui/components/page-header";
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
  let loadError: string | null = null;
  try {
    rows = await c.submissions.listMine(
      status !== undefined ? { status, limit: 50, offset: 0 } : { limit: 50, offset: 0 },
    );
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load submissions.";
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
      <PageHeader
        title="Your submissions"
        description="Submit item details for specialist review. When approved, a draft lot is created for cataloguing and scheduling."
        className="border-0 pb-0"
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
          />
        </Suspense>
      )}
    </DashboardPage>
  );
}

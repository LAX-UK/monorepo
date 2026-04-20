import { SubmissionsBoard } from "@/components/dashboard/submissions-board";
import { Button } from "@/components/ui/button";
import { getMySubmissions } from "@/lib/data/http/submissions.server";
import type { SubmissionListFilterValues } from "@/lib/forms/submission/submission-form-schema";
import type { ItemSubmissionStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default async function DashboardSubmissionsPage({
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

  const initialStatus: SubmissionListFilterValues["status"] = status ?? "all";

  let rows: Awaited<ReturnType<typeof getMySubmissions>> = [];
  let loadError: string | null = null;
  try {
    rows = await getMySubmissions(
      status !== undefined ? { status, limit: 50, offset: 0 } : { limit: 50, offset: 0 },
    );
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load submissions.";
  }

  const tableRows = rows.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Your submissions"
        description="Submit item details for specialist review. When approved, a draft lot is created for cataloguing and scheduling."
        className="border-0 pb-0"
        actions={
          <Button variant="primary" asChild>
            <Link href="/dashboard/submissions/new">New submission</Link>
          </Button>
        }
      />
      {(error || loadError) && (
        <Alert variant="destructive">
          <AlertTitle>Could not load</AlertTitle>
          <AlertDescription>{loadError ?? error}</AlertDescription>
        </Alert>
      )}
      <SubmissionsBoard rows={tableRows} initialStatus={initialStatus} />
    </div>
  );
}

import { EditSubmissionForm } from "@/components/dashboard/edit-submission-form";
import { SubmissionWorkflowActions } from "@/components/dashboard/submission-workflow-actions";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { DisplayHeading } from "@/components/ui/typography";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getSubmissionForUser } from "@/lib/data/http/submissions.server";
import { itemSubmissionToFormValues } from "@/lib/forms/submission/item-submission-form-defaults";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SubmissionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSubmissionForUser(id);
  if (!s) notFound();

  const catReader = await getServerCategoryReader();
  const allCats = await catReader.list();
  const categories = allCats.filter((c) => c.parentId == null);
  const editable = s.status === "draft";
  const canSubmit = s.status === "draft";
  const canWithdraw = s.status === "draft" || s.status === "submitted";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/dashboard/submissions"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Submissions
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <DisplayHeading as="h1" className="text-3xl">
          {s.title}
        </DisplayHeading>
        <SubmissionStatusBadge status={s.status} />
      </div>
      {!editable ? (
        <div className="space-y-4 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 font-body text-sm text-on-surface-variant">
          <p>{s.description ?? "No description."}</p>
          {s.rejectionReason ? (
            <p className="text-error">
              <span className="font-label text-xs uppercase tracking-widest">Reason</span>
              <br />
              {s.rejectionReason}
            </p>
          ) : null}
          {s.reviewNotes ? (
            <p>
              <span className="font-label text-xs uppercase tracking-widest">Reviewer notes</span>
              <br />
              {s.reviewNotes}
            </p>
          ) : null}
          {s.convertedLotId ? (
            <p>
              View listing:{" "}
              <Link href={`/artwork/${s.convertedLotId}`} className="text-primary underline">
                Open artwork page
              </Link>
            </p>
          ) : null}
          <p className="text-xs">
            Image URLs: {s.images.length ? s.images.join(", ") : "None listed."}
          </p>
        </div>
      ) : (
        <EditSubmissionForm
          submissionId={s.id}
          initialValues={itemSubmissionToFormValues(s)}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}

      <SubmissionWorkflowActions
        submissionId={s.id}
        canSubmit={canSubmit}
        canWithdraw={canWithdraw}
      />
    </div>
  );
}

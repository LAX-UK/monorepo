import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { EditSubmissionForm } from "@/components/dashboard/edit-submission-form";
import { SubmissionWorkflowActions } from "@/components/dashboard/submission-workflow-actions";
import { MediaImage } from "@/components/ui/media-image";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { DisplayHeading } from "@/components/ui/typography";
import { getServerDataContainer } from "@/lib/data/container.server";
import { itemSubmissionToFormValues } from "@/lib/forms/submission/item-submission-form-defaults";
import { lotPath } from "@/lib/seo/url";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SubmissionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getServerDataContainer();
  const [s, categories] = await Promise.all([c.submissions.getMineById(id), c.categories.tree()]);
  if (!s) notFound();
  const editable = s.status === "draft";
  const canSubmit = s.status === "draft";
  const canWithdraw = s.status === "draft" || s.status === "submitted";

  return (
    <DashboardPage className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/dashboard/submissions"
        className="inline-flex min-h-10 items-center font-label text-xs uppercase tracking-widest text-primary hover:underline"
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
        <div className="space-y-4 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 font-body text-sm text-on-surface-variant shadow-sm">
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
              <Link
                href={lotPath({ id: s.convertedLotId, title: s.title })}
                className="text-primary underline"
              >
                Open artwork page
              </Link>
            </p>
          ) : null}
          <div>
            <p className="mb-2 font-label text-xs uppercase tracking-widest">Images</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(s.images.length ? s.images : [null]).map((src, index) => (
                <MediaImage
                  key={`${src ?? "empty"}-${index}`}
                  src={src}
                  alt={src ? `${s.title} submission image ${index + 1}` : ""}
                  label="Submission image"
                  aspect={[1, 1]}
                  sizes="(max-width: 640px) 50vw, 180px"
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EditSubmissionForm
          submissionId={s.id}
          initialValues={itemSubmissionToFormValues(s)}
          categories={categories}
        />
      )}

      <SubmissionWorkflowActions
        submissionId={s.id}
        canSubmit={canSubmit}
        canWithdraw={canWithdraw}
      />
    </DashboardPage>
  );
}

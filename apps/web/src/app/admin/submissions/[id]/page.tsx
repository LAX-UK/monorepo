import { Button } from "@/components/ui/button";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { TextareaField } from "@/components/ui/textarea-field";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import {
  adminApproveSubmissionAction,
  adminRejectSubmissionAction,
  adminStartSubmissionReviewAction,
} from "@/lib/actions/admin-submissions";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { ReviewSplitPane } from "@auction/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminSubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const s = await getAdminSubmissionById(id);
  if (!s) notFound();

  const record = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DisplayHeading as="h2" className="text-2xl md:text-3xl">
          {s.title}
        </DisplayHeading>
        <SubmissionStatusBadge status={s.status} />
      </div>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-6 font-body text-sm">
        <p>
          <span className="font-label text-xs uppercase tracking-widest text-secondary">Seller</span>{" "}
          {s.sellerId}
        </p>
        <p>{s.description ?? "—"}</p>
        <p className="text-on-surface-variant">
          Medium: {s.medium ?? "—"} · Dimensions: {s.dimensions ?? "—"}
        </p>
        <p className="text-on-surface-variant">
          Asking: {s.askingPrice ?? "—"} · Reserve: {s.reservePrice ?? "—"}
        </p>
        <div>
          <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">Image URLs</p>
          {s.images.length === 0 ? (
            <p className="text-on-surface-variant">None</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-primary">
              {s.images.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noreferrer" className="break-all underline">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {s.submitterNotes ? (
          <p>
            <span className="font-label text-xs uppercase tracking-widest text-secondary">Seller notes</span>
            <br />
            {s.submitterNotes}
          </p>
        ) : null}
      </div>
      {s.status === "rejected" && s.rejectionReason ? (
        <p className="text-sm text-error">Rejected: {s.rejectionReason}</p>
      ) : null}
    </div>
  );

  const decision = (
    <div className="space-y-8">
      {s.status === "submitted" ? (
        <form action={adminStartSubmissionReviewAction}>
          <input type="hidden" name="submissionId" value={s.id} />
          <Button type="submit" className="min-h-11 w-full sm:w-auto">
            Start review
          </Button>
        </form>
      ) : null}

      {s.status === "under_review" ? (
        <div className="space-y-8">
          <form action={adminApproveSubmissionAction} className="space-y-4">
            <input type="hidden" name="submissionId" value={s.id} />
            <TextareaField
              id="reviewNotesApprove"
              name="reviewNotes"
              label="Internal review notes (optional)"
              rows={3}
            />
            <Button type="submit" className="min-h-11 w-full sm:w-auto">
              Approve and create draft lot
            </Button>
          </form>
          <form action={adminRejectSubmissionAction} className="space-y-4 border-t border-outline-variant/15 pt-8">
            <input type="hidden" name="submissionId" value={s.id} />
            <div>
              <label htmlFor="rejectionReason" className="mb-2 block">
                <LabelCaps>Rejection reason (required)</LabelCaps>
              </label>
              <textarea
                id="rejectionReason"
                name="rejectionReason"
                required
                rows={3}
                className="w-full rounded-md border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 font-body text-base md:text-sm"
              />
            </div>
            <TextareaField
              id="reviewNotesReject"
              name="reviewNotes"
              label="Additional notes (optional)"
              rows={2}
            />
            <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
              Reject
            </Button>
          </form>
        </div>
      ) : null}

      {s.status !== "submitted" && s.status !== "under_review" ? (
        <p className="text-sm text-on-surface-variant">No further actions for this status.</p>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-6">
      <Link
        href="/admin/submissions"
        className="inline-flex min-h-11 items-center font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Queue
      </Link>

      <ReviewSplitPane
        recordTitle="Intake"
        decisionTitle="Decision"
        mobileStickyAction={
          <Link
            href="/admin/submissions"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-outline-variant/20 bg-surface-container-low px-4 font-label text-xs uppercase tracking-widest text-on-surface hover:bg-surface-container-high/60"
          >
            Back to queue
          </Link>
        }
        record={record}
        decision={decision}
      />
    </div>
  );
}

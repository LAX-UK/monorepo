import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminSubmissionDecisionPanel } from "@/components/admin/admin-submission-decision-panel";
import {
  SubmissionDocumentsSection,
  SubmissionMetadataSummary,
} from "@/components/admin/submission-review/submission-staff-sections";
import { MediaImage } from "@/components/ui/media-image";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { getAdminArtistList, getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { ReviewSplitPane } from "@auction/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminSubmissionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getAdminSubmissionById(id);
  if (!s) notFound();

  const submitterLegalEntityId = s.legalEntityId ?? s.sellerId ?? null;
  const [submitterEntity, artistList, staffDocuments] = await Promise.all([
    submitterLegalEntityId
      ? getAdminLegalEntityById(submitterLegalEntityId).catch(() => null)
      : Promise.resolve(null),
    getAdminArtistList({ limit: 500 }).catch(() => ({ rows: [], total: 0 })),
    getServerSubmissionDocuments(id),
  ]);
  const artists = artistList.rows;
  const submitterDisplayName = submitterEntity?.displayName;

  const submissionRecord = (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border-hairline bg-surface-container-low/40 p-6 font-body text-sm">
        <p>
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Seller
          </span>{" "}
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
          <p className="mb-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Images
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(s.images.length ? s.images : [null]).map((src, index) => (
              <a
                key={`${src ?? "empty"}-${index}`}
                href={src ?? undefined}
                target={src ? "_blank" : undefined}
                rel={src ? "noreferrer" : undefined}
                aria-disabled={!src}
                className={!src ? "pointer-events-none" : undefined}
              >
                <MediaImage
                  src={src}
                  alt={src ? `${s.title} submission image ${index + 1}` : ""}
                  label="Submission image"
                  aspect={[1, 1]}
                  sizes="(max-width: 640px) 50vw, 180px"
                />
              </a>
            ))}
          </div>
        </div>
        {s.submitterNotes ? (
          <p>
            <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Seller notes
            </span>
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
    <AdminSubmissionDecisionPanel
      submissionId={s.id}
      status={s.status}
      artists={artists}
      {...(submitterDisplayName ? { submitterDisplayName } : {})}
    />
  );

  return (
    <AdminEntityDetailShell
      breadcrumbs={
        <Link
          href="/admin/submissions"
          className="inline-flex min-h-11 items-center font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Queue
        </Link>
      }
      title={s.title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SubmissionStatusBadge status={s.status} />
          <Link
            href={`/admin/audit/timeline?aggregateType=item_submission&aggregateId=${id}`}
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary hover:text-primary hover:underline"
          >
            Audit ↗
          </Link>
        </div>
      }
    >
      <ReviewSplitPane
        recordTitle="Intake"
        decisionTitle="Decision"
        mobileStickyAction={
          <Link
            href="/admin/submissions"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-hairline bg-surface-container-low px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-high/60"
          >
            Back to queue
          </Link>
        }
        record={
          <div className="space-y-6">
            {submissionRecord}
            <SubmissionMetadataSummary submission={s} />
            <SubmissionDocumentsSection submissionId={id} initialDocuments={staffDocuments} />
          </div>
        }
        decision={decision}
      />
    </AdminEntityDetailShell>
  );
}

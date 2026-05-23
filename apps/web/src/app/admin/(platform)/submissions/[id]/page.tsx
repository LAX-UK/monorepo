import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminSubmissionDecisionPanel } from "@/components/admin/admin-submission-decision-panel";
import { AdminSubmissionDetailCatalogShell } from "@/components/admin/admin-submission-detail-catalog-shell";
import { CatalogInfoAside } from "@/components/admin/catalog";
import { SubmissionInternalDetailsCollapsible } from "@/components/admin/submission-review/submission-internal-details-collapsible";
import {
  SubmissionDocumentsSection,
  SubmissionMetadataSummary,
} from "@/components/admin/submission-review/submission-staff-sections";
import { MediaImage } from "@/components/ui/media-image";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { formatDateTime } from "@/lib/ui/format";
import type { ItemSubmission } from "@auction/types";
import Link from "next/link";
import { notFound } from "next/navigation";

function InnerMeta({ submission }: { submission: ItemSubmission }) {
  const s = submission;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div>
        <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          Submission ID
        </dt>
        <dd className="break-all font-mono text-xs text-on-surface">{s.id}</dd>
      </div>
      {(s.sellerId || s.legalEntityId) && (
        <div className="sm:col-span-2">
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Legal entity / seller identifiers
          </dt>
          <dd className="space-y-1 font-mono text-xs text-on-surface">
            {s.legalEntityId ? <p>Legal entity: {s.legalEntityId}</p> : null}
            {s.sellerId ? <p>Seller (legacy): {s.sellerId}</p> : null}
          </dd>
        </div>
      )}
      {(s.categoryIds?.length ?? 0) > 0 ? (
        <div className="sm:col-span-2">
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Category IDs
          </dt>
          <dd className="break-all font-mono text-xs text-on-surface">
            {(s.categoryIds ?? []).join(", ") || "—"}
          </dd>
        </div>
      ) : (
        <div>
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Primary category ID (legacy)
          </dt>
          <dd className="break-all font-mono text-xs text-on-surface">{s.categoryId}</dd>
        </div>
      )}
      <div>
        <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          Created / updated (UTC)
        </dt>
        <dd className="text-xs text-on-surface">
          {formatDateTime(s.createdAt)} · {formatDateTime(s.updatedAt)}
        </dd>
      </div>
      {s.reviewedAt ? (
        <div>
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Reviewed
          </dt>
          <dd className="text-xs text-on-surface">
            {formatDateTime(s.reviewedAt)}
            {s.reviewedBy ? (
              <>
                {" "}
                by <span className="font-mono">{s.reviewedBy.slice(0, 8)}…</span>
              </>
            ) : null}
          </dd>
        </div>
      ) : (
        <div>
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Reviewed
          </dt>
          <dd className="text-xs text-on-surface">—</dd>
        </div>
      )}
      <div className="sm:col-span-2">
        <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          Staff review notes on record
        </dt>
        <dd className="whitespace-pre-wrap text-xs text-on-surface">{s.reviewNotes ?? "—"}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          Converted lot ID
        </dt>
        <dd className="break-all font-mono text-xs text-on-surface">
          {s.convertedLotId ? (
            <Link href={`/admin/lots/${s.convertedLotId}`} className="text-primary underline">
              {s.convertedLotId}
            </Link>
          ) : (
            "—"
          )}
        </dd>
      </div>
      {s.signatureNote ? (
        <div className="sm:col-span-2">
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Signature note (seller-provided technical)
          </dt>
          <dd className="whitespace-pre-wrap text-xs text-on-surface">{s.signatureNote}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export default async function AdminSubmissionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getAdminSubmissionById(id);
  if (!s) notFound();

  const submitterLegalEntityId = s.legalEntityId ?? s.sellerId ?? null;
  const [submitterEntity, staffDocuments] = await Promise.all([
    submitterLegalEntityId
      ? getAdminLegalEntityById(submitterLegalEntityId).catch(() => null)
      : Promise.resolve(null),
    getServerSubmissionDocuments(id),
  ]);
  const submitterDisplayName = submitterEntity?.displayName;
  const submitterUserId = submitterEntity?.createdByUserId ?? null;

  const submissionRecord = (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border-hairline bg-surface-container-low/40 p-6 font-body text-sm">
        <p>
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Seller
          </span>
          <br />
          <span className="text-base font-medium text-on-surface">
            {submitterDisplayName ?? "Unknown submitter"}
          </span>
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

      <SubmissionInternalDetailsCollapsible>
        <InnerMeta submission={s} />
      </SubmissionInternalDetailsCollapsible>
    </div>
  );

  const decision = (
    <AdminSubmissionDecisionPanel
      submissionId={s.id}
      status={s.status}
      {...(submitterDisplayName ? { submitterDisplayName } : {})}
      {...(submitterUserId ? { submitterUserId } : {})}
    />
  );

  return (
    <AdminSubmissionDetailCatalogShell submissionId={s.id} title={s.title} status={s.status}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          <div className="lg:hidden">{decision}</div>
          {submissionRecord}
          <SubmissionMetadataSummary submission={s} />
          <SubmissionDocumentsSection submissionId={id} initialDocuments={staffDocuments} />
        </div>
        <aside className="hidden min-w-0 space-y-4 lg:block">
          <CatalogInfoAside
            entityId={id}
            updatedAt={s.updatedAt}
            status={<AdminStatusBadge domain="submission" status={s.status} />}
          />
          <div className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:self-start lg:overscroll-contain lg:pb-8">
            {decision}
          </div>
        </aside>
      </div>
    </AdminSubmissionDetailCatalogShell>
  );
}

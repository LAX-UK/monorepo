import {
  CatalogDetailSection,
  CatalogDetailSummaryStrip,
  CatalogDetailTabPanel,
} from "@/components/admin/catalog";
import { SubmissionInternalDetailsCollapsible } from "@/components/admin/submission-review/submission-internal-details-collapsible";
import { SubmissionMetadataSummary } from "@/components/admin/submission-review/submission-staff-sections";
import { MediaImage } from "@/components/ui/media-image";
import { buildSubmissionSummaryItems } from "@/lib/admin/build-submission-summary-items";
import { formatDateTime } from "@/lib/ui/format";
import type { ItemSubmission } from "@auction/types";
import Link from "next/link";

function InnerMeta({
  submission,
  categories,
  submitterDisplayName,
}: {
  submission: ItemSubmission;
  categories: { id: string; name: string }[];
  submitterDisplayName: string | null;
}) {
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
            Legal entity / seller
          </dt>
          <dd className="space-y-1 text-xs text-on-surface">
            {submitterDisplayName ? <p className="font-medium">{submitterDisplayName}</p> : null}
            {s.legalEntityId ? (
              <p className="font-mono text-on-surface-variant">Legal entity: {s.legalEntityId}</p>
            ) : null}
            {s.sellerId ? (
              <p className="font-mono text-on-surface-variant">Seller (legacy): {s.sellerId}</p>
            ) : null}
          </dd>
        </div>
      )}
      {categories.length > 0 ? (
        <div className="sm:col-span-2">
          <dt className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            Categories
          </dt>
          <dd className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/admin/categories/${category.id}`}
                className="rounded-full border border-border-hairline bg-surface-container-low/50 px-2.5 py-1 text-xs text-on-surface hover:text-primary"
              >
                {category.name}
              </Link>
            ))}
          </dd>
        </div>
      ) : null}
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

type Props = {
  submission: ItemSubmission;
  documentCount: number;
  submitterDisplayName: string | null;
  categories?: { id: string; name: string }[];
};

export function SubmissionOverviewTab({
  submission,
  documentCount,
  submitterDisplayName,
  categories = [],
}: Props) {
  const s = submission;
  const summaryItems = buildSubmissionSummaryItems(s.id, s, documentCount);

  return (
    <CatalogDetailTabPanel framed={false}>
      <CatalogDetailSummaryStrip items={summaryItems} />

      <CatalogDetailSection title="Submission">
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
            <InnerMeta
              submission={s}
              categories={categories}
              submitterDisplayName={submitterDisplayName}
            />
          </SubmissionInternalDetailsCollapsible>
        </div>
      </CatalogDetailSection>

      <SubmissionMetadataSummary submission={s} />
    </CatalogDetailTabPanel>
  );
}

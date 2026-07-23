import { CatalogDetailTabCard } from "@/components/admin/catalog";
import {
  DetailActivityPreviewSection,
  DetailAttentionTable,
  DetailBoardKpiStrip,
  DetailCardGrid,
  DetailEntityTable,
  DetailNoticeBanner,
  DetailQualityGapCard,
  DetailStatValue,
} from "@/components/admin/catalog/detail-board";
import { SubmissionInternalDetailsCollapsible } from "@/components/admin/submission-review/submission-internal-details-collapsible";
import { SubmissionMetadataSummary } from "@/components/admin/submission-review/submission-staff-sections";
import { MediaImage } from "@/components/ui/media-image";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildSubmissionOverviewViewModel } from "@/lib/data/view-models/submission-overview.vm";
import type { ItemSubmission } from "@auction/types";
import Link from "next/link";

type Props = {
  submissionId: string;
  submission: ItemSubmission;
  documentCount: number;
  submitterDisplayName: string | null;
  currentUserId: string;
  assigneeDisplayName?: string | null;
  avgQueueAgeDays?: number | null;
  categories?: { id: string; name: string }[];
  activityEvents?: readonly AdminDomainEventRow[];
};

export function SubmissionOverviewTab({
  submissionId,
  submission,
  documentCount,
  submitterDisplayName,
  currentUserId,
  assigneeDisplayName,
  avgQueueAgeDays,
  categories = [],
  activityEvents = [],
}: Props) {
  const s = submission;
  const vm = buildSubmissionOverviewViewModel({
    submissionId,
    submission: s,
    documentCount,
    submitterDisplayName,
    currentUserId,
    ...(assigneeDisplayName != null ? { assigneeDisplayName } : {}),
    ...(avgQueueAgeDays != null ? { avgQueueAgeDays } : {}),
    categories,
  });

  const artworkCards = (s.images.length ? s.images : [null]).map((src, index) => ({
    id: `image-${index}`,
    title: src ? `Image ${index + 1}` : "No image",
    image: (
      <MediaImage
        src={src}
        alt={src ? `${s.title} submission image ${index + 1}` : ""}
        label="Submission image"
        aspect={[1, 1]}
        sizes="(max-width: 640px) 50vw, 180px"
      />
    ),
    ...(src ? { href: src } : {}),
  }));

  return (
    <div className="space-y-6">
      {vm.nextAction ? (
        <DetailNoticeBanner title={vm.nextAction.title} message={vm.nextAction.message} />
      ) : null}

      <DetailBoardKpiStrip ariaLabel="Submission overview" tiles={vm.kpiTiles} className="mb-0" />

      {vm.qualityGapRows.length > 0 ? <DetailQualityGapCard rows={vm.qualityGapRows} /> : null}

      {vm.attentionRows.length > 0 ? <DetailAttentionTable rows={vm.attentionRows} /> : null}

      <DetailActivityPreviewSection
        title="Recent activity"
        description="Timeline of changes and key events for this submission."
        events={activityEvents}
        exportFilters={{ aggregateType: "submission", aggregateId: submissionId }}
        emptyMessage="No submission activity recorded yet."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CatalogDetailTabCard
          title="Artwork details"
          description="Seller-provided catalogue fields."
        >
          <DetailEntityTable
            rows={vm.artworkDetailRows}
            getRowId={(row) => row.id}
            emptyTitle="No artwork details"
            columns={[
              {
                id: "field",
                header: "Field",
                cell: (row) => <span className="text-on-surface-variant">{row.label}</span>,
              },
              {
                id: "value",
                header: "Value",
                cell: (row) => <DetailStatValue row={row} showVerified />,
              },
            ]}
          />
        </CatalogDetailTabCard>

        <CatalogDetailTabCard
          title="Dimensions"
          description="Physical attributes reported by the seller."
        >
          <DetailEntityTable
            rows={vm.dimensionRows}
            getRowId={(row) => row.id}
            emptyTitle="No dimension details"
            columns={[
              {
                id: "field",
                header: "Field",
                cell: (row) => <span className="text-on-surface-variant">{row.label}</span>,
              },
              {
                id: "value",
                header: "Value",
                cell: (row) => <DetailStatValue row={row} showVerified />,
              },
            ]}
          />
        </CatalogDetailTabCard>
      </div>

      <CatalogDetailTabCard
        title="Images"
        description="Catalogue media supplied with this submission."
      >
        <div className="space-y-4">
          <DetailCardGrid items={artworkCards} columns={3} />
          {s.submitterNotes ? (
            <p className="font-body text-sm text-on-surface">
              <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Seller notes
              </span>
              <br />
              {s.submitterNotes}
            </p>
          ) : null}
          {s.status === "rejected" && s.rejectionReason ? (
            <p className="text-sm text-error">Rejected: {s.rejectionReason}</p>
          ) : null}
        </div>
      </CatalogDetailTabCard>

      <CatalogDetailTabCard
        title="Item metadata"
        description="Physical details reported by the seller."
      >
        <SubmissionMetadataSummary submission={s} />
      </CatalogDetailTabCard>

      <CatalogDetailTabCard
        title="Internal"
        description="IDs, audit trail, and technical fields for staff."
      >
        <SubmissionInternalDetailsCollapsible>
          <DetailEntityTable
            rows={vm.internalRows}
            getRowId={(row) => row.id}
            emptyTitle="No internal metadata"
            columns={[
              {
                id: "field",
                header: "Field",
                cell: (row) => <span className="text-on-surface-variant">{row.label}</span>,
              },
              {
                id: "value",
                header: "Value",
                cell: (row) =>
                  row.id === "lot" && s.convertedLotId ? (
                    <Link href={`/admin/lots/${s.convertedLotId}`} className="text-link underline">
                      {s.convertedLotId}
                    </Link>
                  ) : (
                    <DetailStatValue row={row} className="font-mono text-xs text-on-surface" />
                  ),
              },
            ]}
          />
          {categories.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/admin/categories/${category.id}`}
                  className="rounded-full border border-border-hairline bg-surface-container-low/50 px-2.5 py-1 text-xs text-on-surface hover:text-link"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          ) : null}
        </SubmissionInternalDetailsCollapsible>
      </CatalogDetailTabCard>
    </div>
  );
}

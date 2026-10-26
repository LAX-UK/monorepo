"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { reviewLegalEntityDocumentAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import type { AdminLegalEntityDocument } from "@/lib/data/http/admin.server";
import {
  LEGAL_ENTITY_DOCUMENTS_FILTERS,
  type LegalEntityDocumentsFilter,
  buildLegalEntityDocumentsKpiTiles,
  filterLegalEntityDocuments,
  formatLegalEntityDocumentSize,
  legalEntityDocumentLabel,
  matchesLegalEntityDocumentSearch,
} from "@/lib/data/view-models/legal-entity-documents-tab.vm";
import { notify } from "@/lib/ui/notify";
import {
  type DataColumn,
  Notice,
  PrimaryCell,
  SegmentedControl,
  StaffDate,
  StatGrid,
  StatusBadge,
  TableSearch,
  rowActionsColumn,
} from "@auction/staff-ui";
import { Check, Download, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  legalEntityId: string;
  documents: AdminLegalEntityDocument[];
  error?: string | null;
  success?: string | null;
};

const REVIEW_STATUS = {
  pending: { label: "Pending review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
} as const;

/** The organisation's onboarding and compliance files, and approving or rejecting each. */
export function LegalEntityDocumentsTab({ legalEntityId, documents, error, success }: Props) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const [filter, setFilter] = useState<LegalEntityDocumentsFilter>("all");
  const [search, setSearch] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  const stats = useMemo(
    () =>
      buildLegalEntityDocumentsKpiTiles(documents).map((tile) => ({
        id: tile.id,
        label: tile.label,
        value: tile.value,
        ...(tile.compareHint ? { hint: tile.compareHint } : {}),
      })),
    [documents],
  );
  const rows = useMemo(
    () =>
      filterLegalEntityDocuments(documents, filter).filter((doc) =>
        matchesLegalEntityDocumentSearch(doc, search),
      ),
    [documents, filter, search],
  );

  const approve = async (doc: AdminLegalEntityDocument) => {
    setFailure(null);
    const result = await reviewLegalEntityDocumentAction({
      legalEntityId,
      documentId: doc.id,
      reviewStatus: "approved",
    });
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    notify.success(`${legalEntityDocumentLabel(doc)} approved`);
    router.refresh();
  };

  const reject = (doc: AdminLegalEntityDocument) =>
    confirm.ask({
      title: `Reject ${legalEntityDocumentLabel(doc)}?`,
      description:
        "The document is marked as rejected and the organisation will need to upload it again.",
      confirmLabel: "Reject document",
      cancelLabel: "Keep document",
      tone: "danger",
      run: () =>
        reviewLegalEntityDocumentAction({
          legalEntityId,
          documentId: doc.id,
          reviewStatus: "rejected",
        }),
      success: `${legalEntityDocumentLabel(doc)} rejected`,
    });

  const columns: DataColumn<AdminLegalEntityDocument>[] = [
    {
      id: "document",
      header: "Document",
      mobile: "title",
      cell: (doc) => (
        <PrimaryCell
          secondary={`${doc.contentType ?? "Unknown type"} · ${formatLegalEntityDocumentSize(doc.byteSize)}`}
        >
          {legalEntityDocumentLabel(doc)}
        </PrimaryCell>
      ),
    },
    {
      id: "status",
      header: "Review status",
      width: "160px",
      mobile: "badge",
      cell: (doc) => {
        const status = REVIEW_STATUS[doc.reviewStatus as keyof typeof REVIEW_STATUS] ?? {
          label: doc.reviewStatus,
          tone: "neutral" as const,
        };
        return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
      },
    },
    {
      id: "uploaded",
      header: "Uploaded",
      width: "160px",
      mobile: "meta",
      cell: (doc) => <StaffDate value={doc.uploadedAt} withTime />,
    },
    rowActionsColumn<AdminLegalEntityDocument>({
      label: (doc) => `Actions for ${legalEntityDocumentLabel(doc)}`,
      actions: (doc) => [
        {
          id: "download",
          label: "Download",
          icon: Download,
          onSelect: () => window.open(doc.downloadUrl, "_blank", "noopener"),
        },
        ...(doc.reviewStatus === "pending"
          ? [
              {
                id: "approve",
                label: "Approve",
                icon: Check,
                onSelect: () => void approve(doc),
              },
              {
                id: "reject",
                label: "Reject…",
                icon: X,
                tone: "danger" as const,
                onSelect: () => reject(doc),
              },
            ]
          : []),
      ],
    }),
  ];

  return (
    <>
      {success ? <Notice tone="success" title={success} /> : null}
      {error || failure ? (
        <Notice tone="danger" alert title="The document was not updated">
          {error ?? failure}
        </Notice>
      ) : null}
      <StatGrid label="Documents summary" className="grid-cols-3 md:grid-cols-3" items={stats} />
      <RelatedRecordsSection<AdminLegalEntityDocument>
        title="Documents"
        description="Uploaded onboarding and compliance files for this organisation."
        label="Legal entity documents"
        columns={columns}
        data={rows}
        getRowId={(doc) => doc.id}
        defaultSort={{ columnId: "uploaded", direction: "desc" }}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-staff-line px-4 py-2.5">
            <SegmentedControl
              label="Filter documents by review status"
              value={filter}
              onValueChange={setFilter}
              options={LEGAL_ENTITY_DOCUMENTS_FILTERS.map((f) => ({ value: f.id, label: f.label }))}
            />
            <TableSearch
              value={search}
              onSearch={setSearch}
              placeholder="Search documents"
              label="Search documents"
              live
            />
          </div>
        }
        empty={{
          title: "No documents uploaded yet",
          description:
            "Onboarding and compliance files appear here once the organisation uploads them.",
        }}
      />
      {confirm.dialog}
    </>
  );
}

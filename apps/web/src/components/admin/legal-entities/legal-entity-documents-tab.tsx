"use client";

import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import {
  DetailBoardKpiStrip,
  DetailBoardShell,
  DetailBoardToolbar,
  DetailEntityTable,
} from "@/components/admin/catalog/detail-board";
import { documentReviewStatusBadgeVariant } from "@/components/organisations/labels";
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
import { presentationToDotStatus } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  documents: AdminLegalEntityDocument[];
  error?: string | null;
  success?: string | null;
};

export function LegalEntityDocumentsTab({ legalEntityId, documents, error, success }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LegalEntityDocumentsFilter>("all");
  const [search, setSearch] = useState("");

  const kpiTiles = useMemo(() => buildLegalEntityDocumentsKpiTiles(documents), [documents]);
  const filteredDocuments = useMemo(
    () =>
      filterLegalEntityDocuments(documents, filter).filter((doc) =>
        matchesLegalEntityDocumentSearch(doc, search),
      ),
    [documents, filter, search],
  );

  function review(documentId: string, reviewStatus: "approved" | "rejected") {
    setLocalError(null);
    startTransition(async () => {
      const result = await reviewLegalEntityDocumentAction({
        legalEntityId,
        documentId,
        reviewStatus,
      });
      if (!result.ok) {
        setLocalError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {success ? (
        <AdminListAlert title="Done" variant="default">
          {success}
        </AdminListAlert>
      ) : null}
      {error || localError ? (
        <AdminListAlert title="Could not update document">{error ?? localError}</AdminListAlert>
      ) : null}

      <DetailBoardKpiStrip ariaLabel="Documents summary" tiles={kpiTiles} />
      <DetailBoardShell
        title="Documents"
        description="Uploaded onboarding and compliance files for this organisation."
        count={filteredDocuments.length}
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search documents…"
            filters={LEGAL_ENTITY_DOCUMENTS_FILTERS}
            activeFilter={filter}
            onFilterChange={setFilter}
            filterAriaLabel="Filter documents by review status"
          />
        }
      >
        <DetailEntityTable
          rows={filteredDocuments}
          getRowId={(doc) => doc.id}
          ariaLabel="Legal entity documents"
          emptyTitle="No documents uploaded yet"
          columns={[
            {
              id: "document",
              header: "Document",
              cell: (doc) => (
                <div className="min-w-0">
                  <p className="font-headline text-sm font-medium text-on-surface">
                    {legalEntityDocumentLabel(doc)}
                  </p>
                  <p className="mt-0.5 font-body text-xs text-on-surface-variant">
                    {doc.contentType ?? "Unknown type"} ·{" "}
                    {formatLegalEntityDocumentSize(doc.byteSize)}
                  </p>
                </div>
              ),
            },
            {
              id: "status",
              header: "Review status",
              cell: (doc) => (
                <DotStatusPill
                  {...presentationToDotStatus({
                    label: doc.reviewStatus,
                    variant: documentReviewStatusBadgeVariant(
                      doc.reviewStatus as "pending" | "approved" | "rejected",
                    ),
                  })}
                />
              ),
            },
            {
              id: "uploaded",
              header: "Uploaded",
              cell: (doc) => (
                <AdminTableDateTimeCell iso={doc.uploadedAt.toISOString()} mode="timestamp" />
              ),
            },
            {
              id: "actions",
              header: "Actions",
              cell: (doc) => (
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                      Download
                    </a>
                  </Button>
                  {doc.reviewStatus === "pending" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => review(doc.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => review(doc.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </DetailBoardShell>
    </div>
  );
}

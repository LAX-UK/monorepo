"use client";

import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import {
  DetailBoardKpiStrip,
  DetailBoardShell,
  DetailBoardToolbar,
  DetailEntityTable,
} from "@/components/admin/catalog/detail-board";
import { ConfirmedRemoveButton } from "@/components/admin/confirmed-remove-button";
import { SaleDocumentsTabbedPanel } from "@/components/admin/sale-form/sale-documents-tabbed-panel";
import { adminRemoveSaleDocumentResultAction } from "@/lib/actions/admin-documents";
import { downloadSaleDocumentsCsv } from "@/lib/admin/export-sale-documents-csv";
import {
  SALE_DOCUMENTS_FILTERS,
  type SaleDocumentsFilter,
  buildSaleDocumentsKpiTiles,
  documentCreatedAtIso,
  documentDisplayName,
  documentTypeLabel,
  documentVisibilityLabel,
  documentVisibilityTone,
  filterSaleDocuments,
  matchesSaleDocumentSearch,
} from "@/lib/data/view-models/sale-documents-tab.vm";
import { notify } from "@/lib/ui/notify";
import type { EntityDocument } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  documents: EntityDocument[];
};

export function SaleDocumentsTab({ saleId, saleTitle, documents }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<SaleDocumentsFilter>("internal");
  const [search, setSearch] = useState("");

  const filteredDocs = useMemo(
    () =>
      filterSaleDocuments(documents, filter).filter((doc) =>
        matchesSaleDocumentSearch(doc, search),
      ),
    [documents, filter, search],
  );

  const kpiTiles = buildSaleDocumentsKpiTiles(documents);

  const removeDocument = (documentId: string) => {
    startTransition(() => {
      void (async () => {
        const result = await adminRemoveSaleDocumentResultAction(saleId, documentId);
        if (result.ok) {
          notify.success("Document removed");
          router.refresh();
          return;
        }
        notify.error(result.error);
      })();
    });
  };

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip ariaLabel="Documents summary" tiles={kpiTiles} />
      <DetailBoardShell
        title="Documents"
        description="Internal staff files and bidder-facing sale documents."
        count={filteredDocs.length}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 gap-1.5"
            disabled={documents.length === 0}
            onClick={() => downloadSaleDocumentsCsv(documents, saleTitle)}
          >
            Export
          </Button>
        }
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search documents…"
            filters={SALE_DOCUMENTS_FILTERS}
            activeFilter={filter}
            onFilterChange={setFilter}
            filterAriaLabel="Filter documents"
          />
        }
        footer={
          filteredDocs.length > 0 ? (
            <span>
              Showing {filteredDocs.length} of {documents.length} document
              {documents.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
      >
        <DetailEntityTable
          rows={filteredDocs}
          getRowId={(doc) => doc.id}
          emptyTitle={filter === "sale" ? "No sale documents yet" : "No internal documents yet"}
          emptyDescription={
            filter === "sale"
              ? "Upload terms of sale and catalogue PDFs for registered bidders."
              : "Upload staff-only files — not shown on the public sale page."
          }
          columns={[
            {
              id: "name",
              header: "Document",
              cell: (doc) => (
                <div className="min-w-0">
                  <Link
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-headline text-sm font-medium text-on-surface hover:text-link"
                  >
                    {documentDisplayName(doc)}
                  </Link>
                  {doc.fileName && doc.fileName !== doc.label ? (
                    <p className="font-body text-xs text-on-surface-variant">{doc.fileName}</p>
                  ) : null}
                </div>
              ),
            },
            {
              id: "type",
              header: "Type",
              cell: (doc) => (
                <span className="font-body text-sm text-on-surface-variant">
                  {documentTypeLabel(doc.kind as EntityDocument["kind"])}
                </span>
              ),
            },
            {
              id: "visibility",
              header: "Visibility",
              cell: (doc) => (
                <DotStatusPill
                  label={documentVisibilityLabel(doc)}
                  tone={documentVisibilityTone(doc)}
                />
              ),
            },
            {
              id: "date",
              header: "Uploaded",
              cell: (doc) => (
                <AdminTableDateTimeCell iso={documentCreatedAtIso(doc)} mode="dateOnly" />
              ),
            },
            {
              id: "actions",
              header: "",
              headerClassName: "sr-only",
              className: "text-right",
              cell: (doc) => (
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" className="h-8 px-2 font-label text-xs" asChild>
                    <Link href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                      Open
                    </Link>
                  </Button>
                  <ConfirmedRemoveButton
                    ariaLabel="Remove document"
                    confirmTitle="Remove document?"
                    confirmBody={`Remove "${documentDisplayName(doc)}" from this sale?`}
                    disabled={pending}
                    loading={pending}
                    className="h-8 px-2 font-label text-xs text-error"
                    onConfirmed={() => removeDocument(doc.id)}
                  />
                </div>
              ),
            },
          ]}
        />
      </DetailBoardShell>

      <DetailBoardShell
        title="Upload & manage documents"
        description="Add internal staff files or bidder-facing sale documents."
      >
        <SaleDocumentsTabbedPanel saleId={saleId} initialDocuments={documents} />
      </DetailBoardShell>
    </div>
  );
}

"use client";

import { SaleDocumentsPanel } from "@/components/admin/sale-form/sale-documents-panel";
import {
  downloadSaleDocumentsCsv,
  matchesSaleDocumentSearch,
} from "@/lib/admin/exports/sale-files-csv";
import { CsvExportMenu } from "@auction/staff-ui";
import { TableSearch } from "@auction/staff-ui";
import type { EntityDocument } from "@auction/types";
import { useState } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  documents: EntityDocument[];
  canManage?: boolean;
};

/**
 * The sale's documents tab: a search across both groups and an export that follows it, then
 * bidder-facing and staff-only files, each listed once.
 */
export function SaleDocumentsTab({ saleId, saleTitle, documents, canManage = true }: Props) {
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const matches = (doc: EntityDocument) => matchesSaleDocumentSearch(doc, query);
  const shown = searching ? documents.filter(matches) : documents;

  return (
    <div className="flex flex-col gap-4">
      {documents.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TableSearch
            label="Search documents"
            placeholder="Search by name, file or type"
            value={query}
            onSearch={setQuery}
            live
          />
          <CsvExportMenu
            noun="documents"
            shown={shown.length}
            total={documents.length}
            onExport={(scope) =>
              downloadSaleDocumentsCsv(scope === "shown" ? shown : documents, saleTitle)
            }
          />
        </div>
      ) : null}
      <SaleDocumentsPanel
        saleId={saleId}
        documents={documents}
        canManage={canManage}
        {...(searching ? { matches } : {})}
      />
    </div>
  );
}

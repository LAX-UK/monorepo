"use client";

import { DetailBoardKpiStrip, DetailBoardShell } from "@/components/admin/catalog/detail-board";
import { DocumentAttachmentManager } from "@/components/admin/document-attachment-manager";
import {
  adminAttachLotDocumentResultAction,
  adminRemoveLotDocumentResultAction,
} from "@/lib/actions/admin-documents";
import { buildLotDocumentsKpiTiles } from "@/lib/data/view-models/lot-documents-tab.vm";
import type { EntityDocument } from "@auction/types";
import { lotDocumentKinds } from "@auction/types";
import { useMemo } from "react";

type Props = {
  lotId: string;
  initialDocuments: EntityDocument[];
};

export function LotDocumentsTabBoard({ lotId, initialDocuments }: Props) {
  const kpiTiles = useMemo(() => buildLotDocumentsKpiTiles(initialDocuments), [initialDocuments]);

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip ariaLabel="Document summary" tiles={kpiTiles} />
      <DetailBoardShell
        title="Documents"
        description="Staff-only attachments such as condition reports and provenance files."
        count={initialDocuments.length}
      >
        <div
          id="lot-staff-documents"
          className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6"
        >
          <DocumentAttachmentManager
            entityKind="lot"
            entityId={lotId}
            kinds={lotDocumentKinds}
            initialDocuments={initialDocuments}
            actions={{
              attach: (input) => adminAttachLotDocumentResultAction(lotId, input),
              remove: (documentId) => adminRemoveLotDocumentResultAction(lotId, documentId),
            }}
          />
        </div>
      </DetailBoardShell>
    </div>
  );
}

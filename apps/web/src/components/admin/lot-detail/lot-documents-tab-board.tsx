"use client";

import { StaffDocumentsSection } from "@/components/admin/documents/staff-documents-section";
import {
  adminAttachLotDocumentResultAction,
  adminRemoveLotDocumentResultAction,
} from "@/lib/actions/admin-documents";
import type { EntityDocument } from "@auction/types";
import { lotDocumentKinds } from "@auction/types";
import { useMemo } from "react";

type Props = {
  lotId: string;
  initialDocuments: EntityDocument[];
  canManage?: boolean;
};

/** The lot's staff-only files: condition reports, provenance, authentication and valuations. */
export function LotDocumentsTabBoard({ lotId, initialDocuments, canManage = true }: Props) {
  const actions = useMemo(
    () => ({
      attach: (input: { uploadObjectId: string; kind: string; label: string | null }) =>
        adminAttachLotDocumentResultAction(lotId, input),
      remove: (documentId: string) => adminRemoveLotDocumentResultAction(lotId, documentId),
    }),
    [lotId],
  );
  return (
    <StaffDocumentsSection
      id="lot-staff-documents"
      title="Documents"
      description="Staff only. Not shown on the public lot page."
      entityKind="lot"
      kinds={lotDocumentKinds}
      documents={initialDocuments}
      actions={actions}
      canManage={canManage}
      empty={{
        title: "No documents yet",
        description: "Upload condition reports, provenance or valuation files for this lot.",
      }}
    />
  );
}

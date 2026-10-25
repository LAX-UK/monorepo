"use client";

import { StaffDocumentsSection } from "@/components/admin/documents/staff-documents-section";
import {
  adminAttachSaleDocumentResultAction,
  adminRemoveSaleDocumentResultAction,
} from "@/lib/actions/admin-documents";
import type { EntityDocument } from "@auction/types";
import { useMemo } from "react";

const BIDDER_KINDS = ["terms", "catalog"] as const;
const INTERNAL_KINDS = ["other"] as const;

type Props = {
  saleId: string;
  documents: EntityDocument[];
  canManage?: boolean;
};

/**
 * A sale's files in two groups, each listed once: what registered bidders can open (terms and
 * catalogue) and staff-only files. Each group adds and removes its own files.
 */
export function SaleDocumentsPanel({ saleId, documents, canManage = true }: Props) {
  const { bidderDocs, internalDocs } = useMemo(
    () => ({
      bidderDocs: documents.filter((d) => d.kind === "terms" || d.kind === "catalog"),
      internalDocs: documents.filter((d) => d.kind !== "terms" && d.kind !== "catalog"),
    }),
    [documents],
  );
  const actions = useMemo(
    () => ({
      attach: (input: { uploadObjectId: string; kind: string; label: string | null }) =>
        adminAttachSaleDocumentResultAction(saleId, input),
      remove: (documentId: string) => adminRemoveSaleDocumentResultAction(saleId, documentId),
    }),
    [saleId],
  );

  return (
    <div className="flex flex-col gap-4">
      <StaffDocumentsSection
        id="sale-documents"
        title="For bidders"
        description="Terms of sale and catalogues. Registered bidders can open these."
        entityKind="sale"
        kinds={BIDDER_KINDS}
        documents={bidderDocs}
        actions={actions}
        canManage={canManage}
        empty={{
          title: "No bidder documents yet",
          description: "Upload the terms of sale or a catalogue PDF for registered bidders.",
        }}
      />
      <StaffDocumentsSection
        id="internal-documents"
        title="Staff only"
        description="Internal files. Not shown on the public sale page."
        entityKind="sale"
        kinds={INTERNAL_KINDS}
        documents={internalDocs}
        actions={actions}
        canManage={canManage}
        empty={{
          title: "No internal documents yet",
          description: "Upload consignment paperwork, insurance or other files for staff.",
        }}
      />
    </div>
  );
}

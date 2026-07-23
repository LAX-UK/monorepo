"use client";

import { DocumentAttachmentManager } from "@/components/admin/document-attachment-manager";
import {
  adminAttachSaleDocumentResultAction,
  adminRemoveSaleDocumentResultAction,
} from "@/lib/actions/admin-documents";
import type { EntityDocument } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useMemo, useState } from "react";

const INTERNAL_KINDS = ["other"] as const;
const SALE_KINDS = ["terms", "catalog"] as const;

type TabId = "internal" | "sale";

type Props = {
  saleId: string;
  initialDocuments: EntityDocument[];
};

export function SaleDocumentsTabbedPanel({ saleId, initialDocuments }: Props) {
  const [tab, setTab] = useState<TabId>("internal");

  const { internalDocs, saleDocs } = useMemo(() => {
    const internal = initialDocuments.filter((d) => d.kind === "other");
    const sale = initialDocuments.filter((d) => d.kind === "terms" || d.kind === "catalog");
    return { internalDocs: internal, saleDocs: sale };
  }, [initialDocuments]);

  const actions = {
    attach: (input: { uploadObjectId: string; kind: string; label: string | null }) =>
      adminAttachSaleDocumentResultAction(saleId, input),
    remove: (documentId: string) => adminRemoveSaleDocumentResultAction(saleId, documentId),
  };

  return (
    <div className="space-y-4">
      <div
        className="inline-flex rounded-full border border-shell-stroke p-1"
        role="tablist"
        aria-label="Document categories"
      >
        {(
          [
            ["internal", "Internal documents"],
            ["sale", "Sale documents"],
          ] as const
        ).map(([id, label]) => {
          const active = tab === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-full px-4 py-1.5 font-label text-xs font-medium transition-colors",
                active
                  ? "bg-on-surface text-surface-container-lowest"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {label}
            </Button>
          );
        })}
      </div>

      {tab === "internal" ? (
        <DocumentAttachmentManager
          entityKind="sale"
          entityId={saleId}
          kinds={INTERNAL_KINDS}
          initialDocuments={internalDocs}
          actions={actions}
          sectionTitle="Internal documents"
          sectionDescription="Staff-only files — not shown on the public sale page."
        />
      ) : (
        <DocumentAttachmentManager
          entityKind="sale"
          entityId={saleId}
          kinds={SALE_KINDS}
          initialDocuments={saleDocs}
          actions={actions}
          sectionTitle="Sale documents"
          sectionDescription="Terms, catalog PDFs, and bidder-facing attachments."
        />
      )}
    </div>
  );
}

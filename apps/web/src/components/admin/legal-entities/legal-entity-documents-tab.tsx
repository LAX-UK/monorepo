"use client";

import { AdminEntityTabPanel } from "@/components/admin/admin-entity-tab-panel";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { documentReviewStatusBadgeVariant } from "@/components/organisations/labels";
import { reviewLegalEntityDocumentAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import type { AdminLegalEntityDocument } from "@/lib/data/http/admin.server";
import { presentationToDotStatus } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  documents: AdminLegalEntityDocument[];
  error?: string | null;
  success?: string | null;
};

function docLabel(doc: AdminLegalEntityDocument): string {
  if (doc.label?.trim()) return doc.label;
  return doc.kind.replaceAll("_", " ");
}

export function LegalEntityDocumentsTab({ legalEntityId, documents, error, success }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

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
    <AdminEntityTabPanel>
      {success ? (
        <AdminListAlert title="Done" variant="default">
          {success}
        </AdminListAlert>
      ) : null}
      {error || localError ? (
        <AdminListAlert title="Could not update document">{error ?? localError}</AdminListAlert>
      ) : null}

      {documents.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No documents uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-border-hairline">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-body text-sm font-medium text-on-surface">{docLabel(doc)}</p>
                <p className="font-body text-xs text-on-surface-variant">
                  {doc.contentType ?? "Unknown type"}
                  {doc.byteSize ? ` · ${Math.round(doc.byteSize / 1024)} KB` : null}
                </p>
                <DotStatusPill
                  {...presentationToDotStatus({
                    label: doc.reviewStatus,
                    variant: documentReviewStatusBadgeVariant(
                      doc.reviewStatus as "pending" | "approved" | "rejected",
                    ),
                  })}
                />
                {doc.reviewNotes ? (
                  <p className="font-body text-xs text-on-surface-variant">{doc.reviewNotes}</p>
                ) : null}
              </div>
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
            </li>
          ))}
        </ul>
      )}
    </AdminEntityTabPanel>
  );
}

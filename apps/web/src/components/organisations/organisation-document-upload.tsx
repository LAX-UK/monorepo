"use client";

import { postOrgOnboardingDocumentAction } from "@/app/(task)/onboarding/organisation/onboarding-actions";
import { uploadObjectFile } from "@/hooks/use-upload-object-lifecycle";
import {
  ORGANISATION_DOCUMENT_ACCEPT,
  ORGANISATION_DOCUMENT_MAX_BYTES,
  organisationDocumentUploadError,
} from "@/lib/organisations/organisation-document-upload-copy";
import type { DocumentUploadTarget } from "@/lib/organisations/organisation-documents.vm";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  entityId: string;
  target: DocumentUploadTarget;
  /** "Upload" or "Replace"; the document's name follows for screen readers. */
  label: string;
  documentTitle: string;
};

/**
 * Sends one document through the same upload and attach path as organisation setup, then
 * reloads the list so the new state shows. A refusal is said under the button.
 */
export function OrganisationDocumentUpload({ entityId, target, label, documentTitle }: Props) {
  const router = useRouter();
  const errorId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > ORGANISATION_DOCUMENT_MAX_BYTES) {
      setError(organisationDocumentUploadError("file_too_large"));
      return;
    }
    startTransition(async () => {
      try {
        const upload = await uploadObjectFile(file, "legal_entity_document");
        const attach = await postOrgOnboardingDocumentAction(entityId, {
          kind: target.kind,
          uploadObjectId: upload.uploadObjectId,
          ...(target.label ? { label: target.label } : {}),
        });
        if (!attach.ok) {
          setError(organisationDocumentUploadError(attach.error));
          return;
        }
        router.refresh();
      } catch {
        setError(organisationDocumentUploadError(null));
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      {/* One size and width for every row's action, so Upload and Replace line up. */}
      <FileUploadTrigger
        accept={ORGANISATION_DOCUMENT_ACCEPT}
        busy={pending}
        buttonSize="default"
        buttonClassName="min-w-28"
        {...(error ? { describedById: errorId } : {})}
        onFilesSelected={(files) => send(files[0])}
      >
        {pending ? "Sending…" : label}
        <span className="sr-only"> {documentTitle}</span>
      </FileUploadTrigger>
      {error ? (
        <p id={errorId} role="alert" className="font-body text-sm text-error sm:text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}

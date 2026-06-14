"use client";

import { DocumentUploadField } from "@/components/forms/document-upload-field";
import { uploadObjectFile } from "@/hooks/use-upload-object-lifecycle";
import { apiBaseUrl } from "@/lib/auth/api-base";
import type { BuyerSourceOfFundsView } from "@/lib/data/http/compliance.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  initial: BuyerSourceOfFundsView;
};

export function SofComplianceClient({ initial }: Props) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const canUpload =
    view.documentsRequested && !view.documentsSubmitted && view.decisionOutcome == null;

  async function attachFile(requestedType: string, file: File) {
    setError(null);
    setUploadingType(requestedType);
    try {
      const upload = await uploadObjectFile(file, "source_of_funds_document");
      const base = apiBaseUrl();
      const res = await fetch(
        `${base}/payments/me/source-of-funds/${encodeURIComponent(view.caseId)}/documents`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uploadObjectId: upload.uploadObjectId,
            requestedType,
            label: file.name,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingType(null);
    }
  }

  function submitForReview() {
    setError(null);
    startTransition(async () => {
      try {
        const base = apiBaseUrl();
        const res = await fetch(
          `${base}/payments/me/source-of-funds/${encodeURIComponent(view.caseId)}/documents/submit`,
          { method: "POST", credentials: "include" },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Submit failed");
        }
        setView((v) => ({ ...v, documentsSubmitted: true }));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submit failed");
      }
    });
  }

  if (view.decisionOutcome === "approved") {
    return (
      <Alert>
        <AlertTitle>Source of funds verified</AlertTitle>
        <AlertDescription>
          Your verification is complete. You can return to your portfolio to complete checkout.
        </AlertDescription>
      </Alert>
    );
  }

  if (view.decisionOutcome === "rejected") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Verification could not be completed</AlertTitle>
        <AlertDescription>
          Our compliance team will contact you if further action is required. Checkout remains on
          hold.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {view.settlementSummary ? (
        <p className="font-body text-sm text-on-surface-variant">{view.settlementSummary}</p>
      ) : null}

      {!view.documentsRequested ? (
        <Alert>
          <AlertTitle>Awaiting instructions</AlertTitle>
          <AlertDescription>
            Your checkout is on hold while we verify your source of funds. Our compliance team will
            send you a secure request when documents are needed — please do not email attachments.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {view.documentRequestNote ? (
            <Surface variant="card" padding="md" className="space-y-2">
              <p className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                Message from our team
              </p>
              <p className="font-body text-sm text-on-surface">{view.documentRequestNote}</p>
            </Surface>
          ) : null}

          <section className="space-y-4">
            <h2 className="font-headline text-lg text-on-surface">Requested documents</h2>
            <ul className="space-y-4">
              {view.requestedDocumentTypes.map((type) => {
                const doc = view.documents.find(
                  (d) => d.requestedType === type && d.statusLabel !== "superseded",
                );
                return (
                  <li key={type}>
                    <Surface variant="card" padding="md" className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-body text-sm font-medium text-on-surface">{type}</p>
                        {doc ? (
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                            {doc.statusLabel === "under_review" ? "Under review" : "Received"}
                          </span>
                        ) : null}
                      </div>
                      {doc?.fileName ? (
                        <p className="font-body text-xs text-on-surface-variant">{doc.fileName}</p>
                      ) : null}
                      {canUpload ? (
                        <DocumentUploadField
                          kind="source_of_funds_document"
                          dropzone
                          busy={pending || uploadingType === type}
                          helperText="PDF or image · max 25 MB"
                          onFileSelected={(file) => attachFile(type, file)}
                        />
                      ) : null}
                    </Surface>
                  </li>
                );
              })}
            </ul>
          </section>

          {view.documentsSubmitted ? (
            <Alert>
              <AlertTitle>Documents submitted</AlertTitle>
              <AlertDescription>
                Thank you — our compliance team is reviewing your documents. We will email you when
                there is an update.
              </AlertDescription>
            </Alert>
          ) : canUpload ? (
            <Button
              type="button"
              variant="primary"
              disabled={
                pending || view.documents.filter((d) => d.statusLabel !== "superseded").length === 0
              }
              onClick={submitForReview}
            >
              Submit for review
            </Button>
          ) : null}
        </>
      )}

      {error ? (
        <p className="font-body text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

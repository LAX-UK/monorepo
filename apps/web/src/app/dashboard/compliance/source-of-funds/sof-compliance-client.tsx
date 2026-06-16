"use client";

import { SofProgressStepper } from "@/components/dashboard/compliance/sof-progress-stepper";
import { DocumentUploadField } from "@/components/forms/document-upload-field";
import { uploadObjectFile } from "@/hooks/use-upload-object-lifecycle";
import { apiBaseUrl } from "@/lib/auth/api-base";
import type { BuyerSourceOfFundsView } from "@/lib/data/http/compliance.server";
import {
  buyerSofSubmitBlockReason,
  computeBuyerSofUploadCompletion,
  friendlyBuyerUploadError,
  resolveBuyerSofNextStep,
} from "@/lib/data/view-models/buyer-sof.vm";
import {
  SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES,
  formatUploadMaxSize,
  isImageFileName,
} from "@/lib/upload-limits";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Props = {
  initial: BuyerSourceOfFundsView;
};

type UploadPhase = "idle" | "uploading" | "scanning" | "error";

type PerTypeUploadState = {
  phase: UploadPhase;
  progress: number;
  error: string | null;
};

export function SofComplianceClient({ initial }: Props) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [perTypeState, setPerTypeState] = useState<Record<string, PerTypeUploadState>>({});
  const errorRefs = useRef<Record<string, HTMLParagraphElement | null>>({});

  useEffect(() => {
    setView(initial);
  }, [initial]);

  const previewUrlsRef = useRef(previewUrls);
  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const uploadInFlight = uploadingType != null || pending;

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!uploadInFlight) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploadInFlight]);

  const canUpload =
    view.documentsRequested && !view.documentsSubmitted && view.decisionOutcome == null;
  const completion = computeBuyerSofUploadCompletion(view);
  const submitBlockReason = buyerSofSubmitBlockReason(view);
  const nextStep = resolveBuyerSofNextStep(view);

  function setTypeState(type: string, patch: Partial<PerTypeUploadState>) {
    setPerTypeState((prev) => ({
      ...prev,
      [type]: {
        phase: "idle",
        progress: 0,
        error: null,
        ...prev[type],
        ...patch,
      },
    }));
  }

  async function attachFile(requestedType: string, file: File) {
    setGlobalError(null);
    setUploadingType(requestedType);
    setTypeState(requestedType, { phase: "uploading", progress: 0, error: null });

    const preview = isImageFileName(file.name) ? URL.createObjectURL(file) : null;
    if (preview) {
      setPreviewUrls((prev) => {
        const existing = prev[requestedType];
        if (existing) URL.revokeObjectURL(existing);
        return { ...prev, [requestedType]: preview };
      });
    }

    try {
      const upload = await uploadObjectFile(file, "source_of_funds_document", {
        onProgress: (loaded, total) => {
          const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setTypeState(requestedType, {
            phase: pct >= 100 ? "scanning" : "uploading",
            progress: Math.min(100, pct),
          });
        },
      });
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
      setTypeState(requestedType, { phase: "idle", progress: 100, error: null });
      router.refresh();
    } catch (e) {
      const message = friendlyBuyerUploadError(e instanceof Error ? e.message : "Upload failed");
      setTypeState(requestedType, { phase: "error", error: message });
      setGlobalError(null);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreviewUrls((prev) => {
          const next = { ...prev };
          delete next[requestedType];
          return next;
        });
      }
      requestAnimationFrame(() => errorRefs.current[requestedType]?.focus());
    } finally {
      setUploadingType(null);
    }
  }

  function submitForReview() {
    if (submitBlockReason) return;
    if (
      !window.confirm(
        "Submit all uploaded documents for review? You won't be able to add more files after submitting.",
      )
    ) {
      return;
    }
    setGlobalError(null);
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
        setGlobalError(e instanceof Error ? e.message : "Submit failed");
      }
    });
  }

  if (view.decisionOutcome === "approved") {
    return (
      <Alert>
        <AlertTitle>Source of funds verified</AlertTitle>
        <AlertDescription>{nextStep.body}</AlertDescription>
      </Alert>
    );
  }

  if (view.decisionOutcome === "rejected") {
    return (
      <Alert>
        <AlertTitle>{nextStep.title}</AlertTitle>
        <AlertDescription>{nextStep.body}</AlertDescription>
      </Alert>
    );
  }

  const maxSizeLabel = formatUploadMaxSize(SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES);
  const helperId = "sof-upload-constraints";

  return (
    <div className="space-y-6">
      <SofProgressStepper view={view} />

      {view.settlementSummary ? (
        <p className="font-body text-sm text-on-surface-variant">{view.settlementSummary}</p>
      ) : null}

      {!view.documentsRequested ? (
        <Alert>
          <AlertTitle>{nextStep.title}</AlertTitle>
          <AlertDescription>
            Your checkout is on hold while we verify your source of funds. Our compliance team will
            send you a secure request when documents are needed — please do not email attachments.{" "}
            {nextStep.body}
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

          <section className="space-y-4" aria-labelledby="sof-documents-heading">
            <div>
              <h2 id="sof-documents-heading" className="font-headline text-lg text-on-surface">
                Requested documents
              </h2>
              <p id={helperId} className="mt-1 font-body text-xs text-on-surface-variant">
                PDF or image · max {maxSizeLabel} per file
              </p>
            </div>
            <ul className="space-y-4">
              {view.requestedDocumentTypes.map((type) => {
                const docsForType = view.documents.filter((d) => d.requestedType === type);
                const activeDoc = docsForType.find((d) => d.statusLabel !== "superseded");
                const supersededDocs = docsForType.filter((d) => d.statusLabel === "superseded");
                const previewUrl = previewUrls[type];
                const typeState = perTypeState[type];
                const isUploadingThis = uploadingType === type;
                const needsUpload = canUpload && !activeDoc;

                return (
                  <li key={type}>
                    <Surface variant="card" padding="md" className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-body text-sm font-medium text-on-surface">{type}</p>
                        {activeDoc ? (
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                            {activeDoc.statusLabel === "under_review" ? "Under review" : "Uploaded"}
                          </span>
                        ) : needsUpload ? (
                          <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-label text-[10px] uppercase tracking-wider text-warning">
                            Still needed
                          </span>
                        ) : null}
                      </div>
                      {previewUrl ? (
                        <div className="relative h-28 w-full max-w-xs overflow-hidden rounded-lg border border-border-hairline bg-surface-container-low">
                          <Image
                            src={previewUrl}
                            alt={`Preview of ${type}`}
                            fill
                            unoptimized
                            className="object-contain p-2"
                            sizes="320px"
                          />
                        </div>
                      ) : null}
                      {activeDoc?.fileName ? (
                        <p className="font-body text-xs text-on-surface-variant">
                          {activeDoc.fileName}
                        </p>
                      ) : null}
                      {typeState?.phase === "uploading" || typeState?.phase === "scanning" ? (
                        <div aria-live="polite" className="space-y-1">
                          <p className="font-body text-xs text-on-surface-variant">
                            {typeState.phase === "scanning"
                              ? "Scanning file…"
                              : `Uploading… ${typeState.progress}%`}
                          </p>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{
                                width: `${typeState.phase === "scanning" ? 100 : typeState.progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {typeState?.error ? (
                        <p
                          ref={(el) => {
                            errorRefs.current[type] = el;
                          }}
                          tabIndex={-1}
                          className="font-body text-xs text-error"
                          role="alert"
                        >
                          {typeState.error}
                        </p>
                      ) : null}
                      {supersededDocs.length > 0 ? (
                        <ul className="space-y-1 border-t border-border-hairline pt-2">
                          {supersededDocs.map((doc) => (
                            <li
                              key={doc.id}
                              className="font-body text-xs text-on-surface-variant line-through decoration-on-surface-variant/50"
                            >
                              Replaced: {doc.fileName ?? doc.label ?? "Previous file"}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {canUpload ? (
                        <DocumentUploadField
                          kind="source_of_funds_document"
                          dropzone
                          busy={pending || isUploadingThis}
                          maxBytes={SOURCE_OF_FUNDS_DOCUMENT_MAX_BYTES}
                          helperText={`PDF or image · max ${maxSizeLabel}`}
                          inputId={`sof-upload-${type.replace(/\s+/g, "-")}`}
                          describedById={helperId}
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
              <AlertTitle>{nextStep.title}</AlertTitle>
              <AlertDescription>{nextStep.body}</AlertDescription>
            </Alert>
          ) : canUpload ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="primary"
                disabled={pending || uploadInFlight || !completion.allUploaded}
                onClick={submitForReview}
              >
                Submit for review
              </Button>
              {submitBlockReason ? (
                <p className="font-body text-xs text-on-surface-variant">{submitBlockReason}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {globalError ? (
        <p className="font-body text-sm text-error" role="alert">
          {globalError}
        </p>
      ) : null}
    </div>
  );
}

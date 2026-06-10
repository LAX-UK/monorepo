"use client";

import {
  postOrgOnboardingDocumentAction,
  postOrgOnboardingStepCompleteAction,
} from "@/app/(task)/onboarding/organisation/onboarding-actions";
import { uploadObjectFile } from "@/hooks/use-upload-object-lifecycle";
import { WIZARD_COPY } from "@/lib/forms/wizard-copy";
import { orgDocumentsStepIntro } from "@/lib/legal-entity/org-onboarding-documents-copy";
import { orgOnboardingStepHref } from "@/lib/legal-entity/org-onboarding-resume";
import { Button } from "@auction/ui/components/button";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { PublicOrganisationSubkind } from "@auction/validators";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type DocumentSlot = {
  kind: string;
  /** Required when kind === other (canonical or free-form). */
  label?: string;
  title: string;
};

type UploadedDocument = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
};

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

function findUploadedForSlot(
  slot: DocumentSlot,
  uploadedDocuments: UploadedDocument[],
): UploadedDocument | undefined {
  if (slot.kind === "other" && slot.label) {
    return uploadedDocuments.find((doc) => doc.kind === "other" && doc.label === slot.label);
  }
  return uploadedDocuments.find((doc) => doc.kind === slot.kind);
}

type Props = {
  entityId: string;
  fresh: boolean;
  subkind: PublicOrganisationSubkind;
  slots: DocumentSlot[];
  uploadedDocuments: UploadedDocument[];
};

export function OrgDocumentsStepClient({
  entityId,
  fresh,
  subkind,
  slots,
  uploadedDocuments,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [otherLabel, setOtherLabel] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const queryOpts = { entityId, ...(fresh ? { fresh: true } : {}) };

  const slotKey = (slot: DocumentSlot) => `${slot.kind}-${slot.label ?? slot.title}`;

  const onUpload = (slot: DocumentSlot, file: File | null) => {
    if (!file) return;
    const key = slotKey(slot);
    setError(null);
    setUploadingKey(key);
    startTransition(async () => {
      try {
        if (file.size > MAX_DOCUMENT_BYTES) {
          throw new Error("File is too large. Maximum size is 15MB.");
        }
        const upload = await uploadObjectFile(file, "legal_entity_document");
        const effectiveLabel =
          slot.kind === "other" ? slot.label?.trim() || otherLabel.trim() : undefined;
        if (slot.kind === "other" && !effectiveLabel) {
          setError("Please enter a document label for this upload.");
          return;
        }
        const attach =
          slot.kind === "other"
            ? await postOrgOnboardingDocumentAction(entityId, {
                kind: "other",
                uploadObjectId: upload.uploadObjectId,
                label: effectiveLabel as string,
              })
            : await postOrgOnboardingDocumentAction(entityId, {
                kind: slot.kind,
                uploadObjectId: upload.uploadObjectId,
              });
        if (!attach.ok) {
          setError(attach.error ?? "Could not attach document.");
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploadingKey(null);
      }
    });
  };

  const onContinue = () => {
    setError(null);
    startTransition(async () => {
      const res = await postOrgOnboardingStepCompleteAction(entityId, "documents");
      if (!res.ok) {
        setError(res.error ?? "Upload all required documents first.");
        return;
      }
      router.push(orgOnboardingStepHref("connect", queryOpts));
    });
  };

  const showFreeformLabel = slots.some((s) => s.kind === "other" && !s.label);

  return (
    <div className="space-y-6 px-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Documents</h2>
        <p className="text-sm text-on-surface-variant">{orgDocumentsStepIntro(subkind)}</p>
      </div>
      {showFreeformLabel ? (
        <div className="space-y-2">
          <Label htmlFor="otherLabel">
            Document label (required for &quot;Other&quot; uploads)
          </Label>
          <Input
            id="otherLabel"
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="e.g. Partnership agreement"
          />
        </div>
      ) : null}
      <ul className="space-y-4">
        {slots.map((slot) => {
          const key = slotKey(slot);
          const isUploading = uploadingKey === key;
          const uploaded = findUploadedForSlot(slot, uploadedDocuments);
          return (
            <li key={key} className="rounded-lg border border-outline-variant/30 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{slot.title}</p>
                    {uploaded ? (
                      <StatusBadge variant="success" size="sm">
                        <CheckCircle2 className="mr-1 size-3" aria-hidden />
                        Uploaded
                      </StatusBadge>
                    ) : null}
                  </div>
                  {slot.label ? (
                    <p className="text-xs text-on-surface-variant">Label: {slot.label}</p>
                  ) : null}
                  {uploaded ? (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Status: {uploaded.reviewStatus.replaceAll("_", " ")}
                    </p>
                  ) : null}
                  {isUploading ? (
                    <p className="mt-1 text-xs text-primary" aria-live="polite">
                      Uploading…
                    </p>
                  ) : null}
                </div>
                <FileUploadTrigger
                  disabled={pending && !isUploading}
                  busy={isUploading}
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onFilesSelected={(files) => onUpload(slot, files[0] ?? null)}
                >
                  {uploaded ? "Replace" : undefined}
                </FileUploadTrigger>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" asChild>
          <Link href={orgOnboardingStepHref("details", queryOpts)}>{WIZARD_COPY.back}</Link>
        </Button>
        <Button type="button" disabled={pending} onClick={onContinue}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

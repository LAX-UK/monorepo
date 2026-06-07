"use client";

import {
  postOrgOnboardingDocumentAction,
  postOrgOnboardingStepCompleteAction,
} from "@/app/(task)/onboarding/organisation/onboarding-actions";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { WIZARD_COPY } from "@/lib/forms/wizard-copy";
import { Button } from "@auction/ui/components/button";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type DocumentSlot = {
  kind: string;
  /** Required when kind === other (canonical or free-form). */
  label?: string;
  title: string;
};

type PresignResponse = {
  data: {
    uploadId: string;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
  };
};

async function errorFromResponse(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

async function uploadLegalEntityDocument(file: File): Promise<string> {
  const base = apiBaseUrl();
  const presign = await fetch(`${base}/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "legal_entity_document",
      contentType: file.type,
      byteSize: file.size,
    }),
  });
  if (!presign.ok) throw new Error(await errorFromResponse(presign, "Could not prepare upload"));
  const presignBody = (await presign.json()) as PresignResponse;
  const headers = new Headers(presignBody.data.requiredHeaders);
  const put = await fetch(presignBody.data.uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!put.ok) throw new Error("Object storage rejected the upload");

  const confirm = await fetch(`${base}/uploads/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uploadId: presignBody.data.uploadId }),
  });
  if (!confirm.ok) throw new Error(await errorFromResponse(confirm, "Could not confirm upload"));
  return presignBody.data.uploadId;
}

type Props = {
  entityId: string;
  fresh: boolean;
  slots: DocumentSlot[];
};

export function OrgDocumentsStepClient({ entityId, fresh, slots }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [otherLabel, setOtherLabel] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const slotKey = (slot: DocumentSlot) => `${slot.kind}-${slot.label ?? slot.title}`;

  const buildQuery = () => {
    const qs = new URLSearchParams({ entityId });
    if (fresh) qs.set("fresh", "1");
    return qs.toString();
  };

  const onUpload = (slot: DocumentSlot, file: File | null) => {
    if (!file) return;
    const key = slotKey(slot);
    setError(null);
    setUploadingKey(key);
    startTransition(async () => {
      try {
        const uploadId = await uploadLegalEntityDocument(file);
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
                uploadObjectId: uploadId,
                label: effectiveLabel as string,
              })
            : await postOrgOnboardingDocumentAction(entityId, {
                kind: slot.kind,
                uploadObjectId: uploadId,
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
      router.push(`/onboarding/organisation/step/connect?${buildQuery()}`);
    });
  };

  const showFreeformLabel = slots.some((s) => s.kind === "other" && !s.label);

  return (
    <div className="space-y-6 px-4">
      <h2 className="text-xl font-semibold">Documents</h2>
      <p className="text-sm text-on-surface-variant">
        Upload PDF or images (max 15MB). Estate organisations use the three labelled
        &quot;other&quot; slots.
      </p>
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
          return (
            <li key={key} className="rounded-lg border border-outline-variant/30 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{slot.title}</p>
                  {slot.label ? (
                    <p className="text-xs text-on-surface-variant">Label: {slot.label}</p>
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
                />
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
        <Button type="button" disabled={pending} onClick={onContinue}>
          {pending ? "Saving…" : "Continue"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">{WIZARD_COPY.finishLater}</Link>
        </Button>
      </div>
    </div>
  );
}

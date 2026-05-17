"use client";

import { apiBaseUrl } from "@/lib/auth/api-base";

export type PresignResponse = {
  data: {
    uploadId: string;
    uploadUrl: string;
    publicUrl: string;
    requiredHeaders: Record<string, string>;
  };
};

export type UploadStatusResponse = {
  data: {
    id: string;
    key: string;
    status: string;
    publicUrl: string | null;
    rejectionReason: string | null;
  };
};

export type ConfirmedUpload = {
  uploadObjectId: string;
  key: string;
  publicUrl: string;
};

export type UploadValidationOutcome =
  | { kind: "active"; upload: ConfirmedUpload }
  | { kind: "still_validating"; status: string }
  | { kind: "rejected"; reason: string }
  | { kind: "timeout" };

const DEFAULT_VALIDATION_TIMEOUT_MS = 60_000;

function uploadValidationTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_UPLOAD_VALIDATION_TIMEOUT_MS;
  if (!raw) return DEFAULT_VALIDATION_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 5_000 ? n : DEFAULT_VALIDATION_TIMEOUT_MS;
}

async function errorFromResponse(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

async function waitForActiveUpload(
  base: string,
  uploadId: string,
): Promise<UploadValidationOutcome> {
  const deadline = Date.now() + uploadValidationTimeoutMs();
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/uploads/${encodeURIComponent(uploadId)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(await errorFromResponse(res, "Could not read upload status"));
    const body = (await res.json()) as UploadStatusResponse;
    if (body.data.status === "active" && body.data.publicUrl) {
      return {
        kind: "active",
        upload: {
          uploadObjectId: body.data.id,
          key: body.data.key,
          publicUrl: body.data.publicUrl,
        },
      };
    }
    if (body.data.status === "rejected") {
      return {
        kind: "rejected",
        reason: body.data.rejectionReason ?? "Upload rejected",
      };
    }
    if (body.data.status === "uploaded" || body.data.status === "pending") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    return { kind: "still_validating", status: body.data.status };
  }
  return { kind: "timeout" };
}

export function uploadValidationErrorMessage(outcome: UploadValidationOutcome): string {
  switch (outcome.kind) {
    case "rejected":
      return outcome.reason;
    case "timeout":
      return "Upload validation timed out. Ensure the validate-upload worker is running, then retry.";
    case "still_validating":
      return `Upload still validating (status: ${outcome.status})`;
    default:
      return "Upload failed";
  }
}

export function useUploadObjectLifecycle() {
  async function uploadFile(file: File, kind: string): Promise<ConfirmedUpload> {
    const base = apiBaseUrl();
    const presign = await fetch(`${base}/uploads/presign`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, contentType: file.type, byteSize: file.size }),
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

    const outcome = await waitForActiveUpload(base, presignBody.data.uploadId);
    if (outcome.kind === "active") return outcome.upload;
    throw new Error(uploadValidationErrorMessage(outcome));
  }

  return { uploadFile };
}

"use client";

import {
  type PresignResponse,
  type UploadStatusResponse,
  confirmUploadObject,
  fetchUploadObjectStatus,
  presignUploadObject,
} from "@/lib/data/http/upload-object-lifecycle.client";

export type { PresignResponse, UploadStatusResponse };

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

export type UploadFileOptions = {
  onProgress?: (loaded: number, total: number) => void;
};

const DEFAULT_VALIDATION_TIMEOUT_MS = 60_000;

function uploadValidationTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_UPLOAD_VALIDATION_TIMEOUT_MS;
  if (!raw) return DEFAULT_VALIDATION_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 5_000 ? n : DEFAULT_VALIDATION_TIMEOUT_MS;
}

function putFileWithProgress(
  url: string,
  file: File,
  headers: Headers,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total);
      });
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        const detail = xhr.responseText?.trim().slice(0, 200);
        reject(
          new Error(
            detail
              ? `Object storage rejected the upload (${xhr.status}: ${detail})`
              : `Object storage rejected the upload (${xhr.status})`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Object storage rejected the upload (network or CORS error — check browser devtools)",
        ),
      );
    xhr.send(file);
  });
}

async function waitForActiveUpload(uploadId: string): Promise<UploadValidationOutcome> {
  const deadline = Date.now() + uploadValidationTimeoutMs();
  while (Date.now() < deadline) {
    const body = await fetchUploadObjectStatus(uploadId);
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

export async function uploadObjectFile(
  file: File,
  kind: string,
  options?: UploadFileOptions,
): Promise<ConfirmedUpload> {
  const presignBody = await presignUploadObject(kind, file.type, file.size);
  const headers = new Headers(presignBody.data.requiredHeaders);
  await putFileWithProgress(presignBody.data.uploadUrl, file, headers, options?.onProgress);
  await confirmUploadObject(presignBody.data.uploadId);

  const outcome = await waitForActiveUpload(presignBody.data.uploadId);
  if (outcome.kind === "active") return outcome.upload;
  throw new Error(uploadValidationErrorMessage(outcome));
}

export function useUploadObjectLifecycle() {
  return { uploadFile: uploadObjectFile };
}

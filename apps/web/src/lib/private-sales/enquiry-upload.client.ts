import { apiBaseUrl } from "@/lib/auth/api-base";
import { putFileWithProgress } from "@/lib/data/http/put-file-with-progress";
import { X_ENQUIRY_DRAFT_HEADER } from "@auction/http-headers";
import type { UploadKindName } from "./enquiry-uploads";

const API_KIND: Record<UploadKindName, string> = {
  image: "enquiry_image",
  document: "enquiry_document",
};

/** A file the checks refused, or one that could not be sent. `reason` is for the queue to show. */
export class EnquiryUploadError extends Error {
  constructor(
    readonly reason: string,
    readonly code?: string,
  ) {
    super(reason);
    this.name = "EnquiryUploadError";
  }
}

export type EnquiryUploadOptions = {
  /** A visitor's draft token; a signed-in sender uploads with their session instead. */
  draftToken?: string | undefined;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** How long to wait for the checks before giving up. */
  validationTimeoutMs?: number;
  pollMs?: number;
};

const DEFAULT_VALIDATION_TIMEOUT_MS = 60_000;

async function call(path: string, init: RequestInit, draftToken: string | undefined) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (draftToken) headers.set(X_ENQUIRY_DRAFT_HEADER, draftToken);
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.ok) return response;
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    code?: string;
  } | null;
  throw new EnquiryUploadError(
    body?.error ?? "the upload didn't start",
    body?.code ?? (response.status === 429 ? "rate_limited" : undefined),
  );
}

type StatusBody = { data: { status: string; rejectionReason: string | null } };

async function waitUntilChecked(
  uploadId: string,
  draftToken: string | undefined,
  options: EnquiryUploadOptions,
): Promise<void> {
  const deadline = Date.now() + (options.validationTimeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS);
  while (Date.now() < deadline) {
    options.signal?.throwIfAborted();
    const response = await call(
      `/uploads/${encodeURIComponent(uploadId)}`,
      { method: "GET" },
      draftToken,
    );
    const { data } = (await response.json()) as StatusBody;
    if (data.status === "active") return;
    if (data.status === "rejected") {
      throw new EnquiryUploadError(data.rejectionReason ?? "rejected", "rejected");
    }
    await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 500));
  }
  throw new EnquiryUploadError("the checks took too long, so we couldn't add that file", "timeout");
}

/**
 * Sends one photo or document through the same steps as every upload: a link from the API, the
 * file to storage, then the worker's checks. Resolves with the server's id for the file once it is
 * safe to attach, or throws {@link EnquiryUploadError} with the reason to show beside it.
 */
export async function uploadEnquiryFile(
  file: File,
  kind: UploadKindName,
  options: EnquiryUploadOptions = {},
): Promise<string> {
  const { draftToken } = options;
  const presign = await call(
    "/uploads/presign",
    {
      method: "POST",
      body: JSON.stringify({ kind: API_KIND[kind], contentType: file.type, byteSize: file.size }),
    },
    draftToken,
  );
  const { data } = (await presign.json()) as {
    data: { uploadId: string; uploadUrl: string; requiredHeaders: Record<string, string> };
  };
  try {
    await putFileWithProgress(
      data.uploadUrl,
      file,
      new Headers(data.requiredHeaders),
      options.onProgress ? (loaded, total) => options.onProgress?.(loaded / total) : undefined,
    );
  } catch {
    throw new EnquiryUploadError("the upload didn't finish", "network");
  }
  await call(
    "/uploads/confirm",
    { method: "POST", body: JSON.stringify({ uploadId: data.uploadId }) },
    draftToken,
  );
  await waitUntilChecked(data.uploadId, draftToken, options);
  return data.uploadId;
}

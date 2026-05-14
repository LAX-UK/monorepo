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

async function errorFromResponse(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

async function waitForActiveUpload(base: string, uploadId: string): Promise<ConfirmedUpload> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/uploads/${encodeURIComponent(uploadId)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(await errorFromResponse(res, "Could not read upload status"));
    const body = (await res.json()) as UploadStatusResponse;
    if (body.data.status === "active" && body.data.publicUrl) {
      return {
        uploadObjectId: body.data.id,
        key: body.data.key,
        publicUrl: body.data.publicUrl,
      };
    }
    if (body.data.status === "rejected") {
      throw new Error(body.data.rejectionReason ?? "Upload rejected");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Upload validation timed out");
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
    return waitForActiveUpload(base, presignBody.data.uploadId);
  }

  return { uploadFile };
}

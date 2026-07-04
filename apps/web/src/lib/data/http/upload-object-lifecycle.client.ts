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

async function errorFromResponse(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

/** POST /uploads/presign */
export async function presignUploadObject(
  kind: string,
  contentType: string,
  byteSize: number,
): Promise<PresignResponse> {
  const res = await fetch(`${apiBaseUrl()}/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, contentType, byteSize }),
  });
  if (!res.ok) throw new Error(await errorFromResponse(res, "Could not prepare upload"));
  return (await res.json()) as PresignResponse;
}

/** POST /uploads/confirm */
export async function confirmUploadObject(uploadId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/uploads/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uploadId }),
  });
  if (!res.ok) throw new Error(await errorFromResponse(res, "Could not confirm upload"));
}

/** GET /uploads/:id */
export async function fetchUploadObjectStatus(uploadId: string): Promise<UploadStatusResponse> {
  const res = await fetch(`${apiBaseUrl()}/uploads/${encodeURIComponent(uploadId)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorFromResponse(res, "Could not read upload status"));
  return (await res.json()) as UploadStatusResponse;
}

import { readCookie } from "./read-cookie";
import { SHOP_ADMIN_CSRF_COOKIE } from "./session-cookie";

export const SHOP_MEDIA_KINDS = [
  "artwork_image",
  "artist_portrait",
  "artist_hero",
  "editorial_cover",
  "editorial_inline",
  "venue_image",
] as const;

export type ShopMediaKind = (typeof SHOP_MEDIA_KINDS)[number];

export type ShopMediaPresignResponse = {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  requiredHeaders: Record<string, string>;
};

export type ShopMediaConfirmResponse = {
  key: string;
  publicUrl: string;
  width: number;
  height: number;
  blurDataUrl: string;
  alt: string | null;
};

async function adminJson<T>(path: string, init: RequestInit): Promise<T> {
  const csrfToken = readCookie(document.cookie, SHOP_ADMIN_CSRF_COOKIE);
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init.headers ?? {}),
    },
    credentials: "same-origin",
  });
  const body = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return body;
}

function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total);
      });
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload rejected (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed (network or CORS)"));
    xhr.send(file);
  });
}

export async function uploadShopMediaFile(input: {
  kind: ShopMediaKind;
  file: File;
  alt?: string;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<ShopMediaConfirmResponse> {
  const presign = await adminJson<ShopMediaPresignResponse>("/api/admin/media/presign", {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      contentType: input.file.type,
      byteSize: input.file.size,
    }),
  });
  await putWithProgress(presign.uploadUrl, input.file, presign.requiredHeaders, input.onProgress);
  return adminJson<ShopMediaConfirmResponse>("/api/admin/media/confirm", {
    method: "POST",
    body: JSON.stringify({
      key: presign.key,
      ...(input.alt?.trim() ? { alt: input.alt.trim() } : {}),
    }),
  });
}

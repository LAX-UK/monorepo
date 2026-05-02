"use client";

import { apiBaseUrl } from "@/lib/auth/api-base";
import { Button } from "@auction/ui/components/button";
import { useRef, useState } from "react";

export type UploadKind = "avatar" | "submission_image" | "lot_image" | "sale_cover";

type UploadFieldProps = {
  kind: UploadKind;
  multiple?: boolean;
  maxFiles?: number;
  value: string[];
  onChange: (next: string[]) => void;
};

type UploadItem = {
  fileName: string;
  status: "uploading" | "validating" | "done" | "error";
  message?: string;
};

type PresignResponse = {
  data: {
    uploadId: string;
    uploadUrl: string;
    publicUrl: string;
    requiredHeaders: Record<string, string>;
  };
};

type UploadStatusResponse = {
  data: {
    status: string;
    publicUrl: string | null;
    rejectionReason: string | null;
  };
};

export function UploadField({
  kind,
  multiple = false,
  maxFiles = multiple ? 20 : 1,
  value,
  onChange,
}: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);

  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).slice(0, Math.max(0, maxFiles - value.length));
    if (fileArray.length === 0) return;
    let nextValue = value;

    for (const file of fileArray) {
      setItems((prev) => [...prev, { fileName: file.name, status: "uploading" }]);
      try {
        const activeUrl = await uploadOne(file, kind);
        nextValue = multiple ? [...nextValue, activeUrl] : [activeUrl];
        onChange(nextValue);
        setItems((prev) =>
          prev.map((item) =>
            item.fileName === file.name ? { ...item, status: "done", message: "Uploaded" } : item,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setItems((prev) =>
          prev.map((item) =>
            item.fileName === file.name ? { ...item, status: "error", message } : item,
          ),
        );
      }
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={`w-full rounded-lg border border-dashed p-6 text-left transition ${
          dragging
            ? "border-primary bg-primary-container/20"
            : "border-outline-variant bg-surface-container-lowest"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadFiles(event.dataTransfer.files);
        }}
      >
        <span className="block font-label text-xs uppercase tracking-[0.25em] text-secondary">
          Upload images
        </span>
        <span className="mt-2 block font-body text-sm text-on-surface-variant">
          Drop files here or click to choose. JPEG, PNG, and WebP are supported.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      {value.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="rounded-md border border-outline-variant/30 p-2">
              <img src={url} alt="" className="h-28 w-full rounded object-cover" />
              <Button
                type="button"
                variant="ghost"
                className="mt-2 h-auto px-2 py-1 text-xs"
                onClick={() => removeAt(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="space-y-1 font-body text-xs text-on-surface-variant">
          {items.map((item, index) => (
            <li key={`${item.fileName}-${index}`}>
              {item.fileName}: {item.message ?? item.status}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

async function uploadOne(file: File, kind: UploadKind): Promise<string> {
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

async function waitForActiveUpload(base: string, uploadId: string): Promise<string> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/uploads/${encodeURIComponent(uploadId)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(await errorFromResponse(res, "Could not read upload status"));
    const body = (await res.json()) as UploadStatusResponse;
    if (body.data.status === "active" && body.data.publicUrl) return body.data.publicUrl;
    if (body.data.status === "rejected") {
      throw new Error(body.data.rejectionReason ?? "Upload rejected");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Upload validation timed out");
}

async function errorFromResponse(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

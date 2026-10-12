"use client";

import { type ShopMediaKind, uploadShopMediaFile } from "@/lib/shop-media-upload.client";
import { useCallback, useId, useState } from "react";

export type MediaUploadItem = {
  id: string;
  fileName: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  key?: string;
  publicUrl?: string;
};

type Props = {
  kind: ShopMediaKind;
  label?: string;
  value: string | null;
  publicUrl?: string | null;
  onChange: (mediaKey: string | null, publicUrl: string | null) => void;
  disabled?: boolean;
  /** When set, the caller owns the alt text and the built-in alt input is hidden. */
  alt?: string;
};

function newItemId(): string {
  return crypto.randomUUID();
}

export function MediaUploadField({
  kind,
  label = "Image",
  value,
  publicUrl,
  onChange,
  disabled = false,
  alt: controlledAlt,
}: Props) {
  const inputId = useId();
  const [ownAlt, setAlt] = useState("");
  const alt = controlledAlt ?? ownAlt;
  const [queue, setQueue] = useState<MediaUploadItem[]>([]);

  const previewSrc = publicUrl ?? (value?.startsWith("http") ? value : null);

  const updateItem = useCallback((id: string, patch: Partial<MediaUploadItem>) => {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file || disabled) return;
      const id = newItemId();
      setQueue((items) => [
        ...items,
        { id, fileName: file.name, progress: 0, status: "uploading" },
      ]);
      try {
        const confirmed = await uploadShopMediaFile({
          kind,
          file,
          alt,
          onProgress: (loaded, total) => {
            updateItem(id, { progress: total > 0 ? Math.round((loaded / total) * 100) : 0 });
          },
        });
        updateItem(id, {
          status: "done",
          progress: 100,
          key: confirmed.key,
          publicUrl: confirmed.publicUrl,
        });
        onChange(confirmed.key, confirmed.publicUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        updateItem(id, { status: "error", error: message });
      }
    },
    [alt, disabled, kind, onChange, updateItem],
  );

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-800">
          {label}
        </label>
        <p className="text-xs text-neutral-500">
          JPEG, PNG or WebP. Upload goes directly to media storage.
        </p>
      </div>

      {previewSrc ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={alt || label}
            className="max-h-48 rounded border object-contain"
          />
          <button
            type="button"
            className="text-sm text-neutral-600 underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => onChange(null, null)}
          >
            Remove
          </button>
        </div>
      ) : null}

      {controlledAlt === undefined ? (
        <label className="block text-sm text-neutral-700">
          Alt text
          <input
            type="text"
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            value={ownAlt}
            disabled={disabled}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={500}
          />
        </label>
      ) : null}

      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="block w-full text-sm"
        disabled={disabled}
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {queue.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {queue.map((item) => (
            <li key={item.id} className="rounded bg-neutral-50 px-3 py-2">
              <div className="flex justify-between gap-2">
                <span className="truncate">{item.fileName}</span>
                <span className="text-neutral-500">{item.status}</span>
              </div>
              {item.status === "uploading" ? (
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-neutral-200">
                  <div
                    className="h-full bg-neutral-800 transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : null}
              {item.error ? <p className="mt-1 text-xs text-red-600">{item.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {value && !previewSrc ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span className="break-all">Stored key: {value}</span>
          <button
            type="button"
            className="text-sm text-neutral-600 underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => onChange(null, null)}
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

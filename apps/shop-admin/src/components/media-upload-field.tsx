"use client";

import { type ShopMediaKind, uploadShopMediaFile } from "@/lib/shop-media-upload.client";
import { Button, FileUploadTrigger, Input, Label, UploadProgress } from "@auction/ui";
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
    async (files: FileList) => {
      const file = files[0];
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
    <div className="space-y-3 rounded-md border border-border-hairline p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={inputId}>{label}</Label>
        <p id={`${inputId}-hint`} className="text-xs text-on-surface-variant">
          JPEG, PNG or WebP. Upload goes directly to media storage.
        </p>
      </div>

      {previewSrc ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={alt || label}
            className="max-h-48 rounded border border-border-hairline object-contain"
          />
          <Button
            type="button"
            variant="link"
            disabled={disabled}
            onClick={() => onChange(null, null)}
          >
            Remove
          </Button>
        </div>
      ) : null}

      {controlledAlt === undefined ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${inputId}-alt`}>Alt text</Label>
          <Input
            id={`${inputId}-alt`}
            type="text"
            value={ownAlt}
            disabled={disabled}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={500}
          />
        </div>
      ) : null}

      <FileUploadTrigger
        inputId={inputId}
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        dropzoneAriaLabel={label}
        describedById={`${inputId}-hint`}
        onFilesSelected={(files) => void onFiles(files)}
      >
        Choose image
      </FileUploadTrigger>

      {queue.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {queue.map((item) => (
            <li key={item.id} className="rounded bg-surface-container-low px-3 py-2">
              <div className="flex justify-between gap-2">
                <span className="truncate">{item.fileName}</span>
                <span className="text-on-surface-variant">{item.status}</span>
              </div>
              {item.status === "uploading" ? (
                <UploadProgress
                  className="mt-1"
                  value={item.progress}
                  label={`Uploading ${item.fileName}`}
                />
              ) : null}
              {item.error ? <p className="mt-1 text-xs text-error">{item.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {value && !previewSrc ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span className="break-all">Stored key: {value}</span>
          <Button
            type="button"
            variant="link"
            disabled={disabled}
            onClick={() => onChange(null, null)}
          >
            Remove
          </Button>
        </div>
      ) : null}
    </div>
  );
}

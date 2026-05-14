"use client";

import { MediaImage } from "@/components/ui/media-image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { Button } from "@auction/ui/components/button";
import { useRef, useState } from "react";

/** Image-only upload kinds (presign + thumbnail UI). */
export type ImageUploadKind =
  | "avatar"
  | "submission_image"
  | "lot_image"
  | "sale_cover"
  | "artist_image";

type ImageUploadFieldProps = {
  kind: ImageUploadKind;
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

type UploadedImage = {
  value: string;
  previewUrl: string;
};

function placeholderLabel(kind: ImageUploadKind): string {
  switch (kind) {
    case "avatar":
      return "Profile";
    case "sale_cover":
      return "Auction cover";
    case "submission_image":
      return "Submission image";
    case "lot_image":
      return "Lot artwork";
    case "artist_image":
      return "Artist image";
  }
}

export function ImageUploadField({
  kind,
  multiple = false,
  maxFiles = multiple ? 20 : 1,
  value,
  onChange,
}: ImageUploadFieldProps) {
  const { uploadFile } = useUploadObjectLifecycle();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const label = placeholderLabel(kind);
  const isAvatar = kind === "avatar";

  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).slice(0, Math.max(0, maxFiles - value.length));
    if (fileArray.length === 0) return;
    let nextValue = value;

    for (const file of fileArray) {
      setItems((prev) => [...prev, { fileName: file.name, status: "uploading" }]);
      try {
        const uploaded = await uploadOneFile(file, kind, uploadFile);
        setPreviewUrls((prev) => ({ ...prev, [uploaded.value]: uploaded.previewUrl }));
        nextValue = multiple ? [...nextValue, uploaded.value] : [uploaded.value];
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
        <div className={isAvatar ? "max-w-40" : "grid gap-3 sm:grid-cols-2"}>
          {value.map((urlOrKey, index) => (
            <div key={urlOrKey} className="rounded-md border border-outline-variant/30 p-2">
              <MediaImage
                src={previewUrls[urlOrKey] ?? urlOrKey}
                alt={label}
                label={label}
                shape={isAvatar ? "circle" : "rect"}
                aspect={[1, 1]}
                sizes={isAvatar ? "160px" : "(max-width: 640px) 100vw, 320px"}
              />
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
      ) : (
        <MediaPlaceholder
          label={label}
          shape={isAvatar ? "circle" : "rect"}
          aspect={[1, 1]}
          className={isAvatar ? "max-w-40" : undefined}
        />
      )}
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

async function uploadOneFile(
  file: File,
  kind: ImageUploadKind,
  uploadFile: ReturnType<typeof useUploadObjectLifecycle>["uploadFile"],
): Promise<UploadedImage> {
  const out = await uploadFile(file, kind);
  return { value: out.key, previewUrl: out.publicUrl };
}

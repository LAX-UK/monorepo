"use client";

import { UploadItem } from "@/components/forms/upload-item";
import { MediaImage } from "@/components/ui/media-image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { useUploadGallery } from "@/lib/forms/image/use-upload-gallery";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";

/** Image-only upload kinds (presign + thumbnail UI). */
export type ImageUploadKind =
  | "avatar"
  | "submission_image"
  | "lot_image"
  | "sale_cover"
  | "artist_image"
  | "category_image";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type ImageUploadFieldProps = {
  kind: ImageUploadKind;
  multiple?: boolean;
  maxFiles?: number;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Map storage key → resolved URL for thumbnails (admin edit of seeded media). */
  previewUrlByKey?: Record<string, string>;
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
    case "category_image":
      return "Category hero";
  }
}

function dropzoneAriaLabel(kind: ImageUploadKind): string {
  switch (kind) {
    case "lot_image":
      return "Upload lot images";
    case "sale_cover":
      return "Upload sale cover images";
    case "artist_image":
      return "Upload artist images";
    case "category_image":
      return "Upload category hero image";
    case "avatar":
      return "Upload profile photo";
    case "submission_image":
      return "Upload submission images";
  }
}

export function ImageUploadField({
  kind,
  multiple = false,
  maxFiles = multiple ? 20 : 1,
  value,
  onChange,
  disabled = false,
  previewUrlByKey = {},
}: ImageUploadFieldProps) {
  const label = placeholderLabel(kind);
  const isAvatar = kind === "avatar";

  const { items, uploadFiles, retry } = useUploadGallery({
    kind,
    value,
    onChange,
    maxFiles,
    onError: (message) => notify.error("Upload failed", { description: message }),
  });

  function removeAt(index: number) {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
  }

  function displaySrc(key: string): string {
    return previewUrlByKey[key] ?? key;
  }

  return (
    <div className="space-y-3">
      <FileUploadTrigger
        dropzone
        disabled={disabled}
        multiple={multiple}
        accept={IMAGE_ACCEPT}
        inputId={`image-upload-${kind}`}
        dropzoneAriaLabel={dropzoneAriaLabel(kind)}
        onFilesSelected={(files) => void uploadFiles(files)}
        className="[&_[role=button]]:min-h-0 [&_[role=button]]:rounded-lg [&_[role=button]]:border-outline-variant [&_[role=button]]:bg-surface-container-lowest [&_[role=button]]:p-6 [&_[role=button]]:text-left"
      >
        <span className="block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Upload images
        </span>
        <span className="mt-2 block font-body text-sm text-on-surface-variant">
          Drop files here or click to choose. JPEG, PNG, WebP, and GIF up to 10 MB each.
        </span>
      </FileUploadTrigger>
      {value.length > 0 ? (
        <div className={isAvatar ? "max-w-40" : "grid gap-3 sm:grid-cols-2"}>
          {value.map((urlOrKey, index) => (
            <div key={urlOrKey} className="rounded-md border border-outline-variant/30 p-2">
              <MediaImage
                src={displaySrc(urlOrKey)}
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
                disabled={disabled}
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
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <UploadItem
              key={item.id}
              item={item}
              {...(disabled ? {} : { onRetry: (fileName: string) => void retry(fileName) })}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import type { ImageUploadKind } from "@/components/forms/image-upload-field";
import { SortableImageCard } from "@/components/forms/sortable-image-card";
import { UploadItem } from "@/components/forms/upload-item";
import {
  type KeyEntry,
  imageEntrySortId,
  useImageReorder,
} from "@/lib/forms/image/use-image-reorder";
import { useUploadGallery } from "@/lib/forms/image/use-upload-gallery";
import { notify } from "@/lib/ui/notify";
import { EmptyState } from "@auction/ui/components/empty-state";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  kind: ImageUploadKind;
  /** Shown on thumbnails / placeholders */
  label: string;
  maxFiles?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  disabled?: boolean;
  /** Map storage key → resolved URL for thumbnails (admin edit of seeded media). */
  previewUrlByKey?: Record<string, string>;
};

function toEntries(keys: string[]): KeyEntry[] {
  return keys.map((key, index) => ({ key, sortId: `${index}::${key}` }));
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

export function ImageGalleryManager({
  value,
  onChange,
  kind,
  label,
  maxFiles = 20,
  emptyTitle = "No images yet",
  emptyDescription = "Upload images, then drag to reorder. The first image is the primary.",
  disabled = false,
  previewUrlByKey = {},
}: Props) {
  const entries = toEntries(value);
  const { sensors, onDragEnd } = useImageReorder({
    value: entries,
    onChange: (next) => onChange(next.map((e) => e.key)),
  });
  const remaining = Math.max(0, maxFiles - value.length);

  const { items, uploadFiles, retry } = useUploadGallery({
    kind,
    value,
    onChange,
    maxFiles,
    onError: (message) => notify.error("Upload failed", { description: message }),
  });

  const makePrimary = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    onChange([item, ...next]);
  };

  const removeAt = (index: number) => {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const displaySrc = (key: string) => previewUrlByKey[key] ?? key;

  return (
    <div className="space-y-4">
      {remaining > 0 ? (
        <div className="flex flex-col gap-2 sm:block">
          <FileUploadTrigger
            dropzone
            disabled={disabled}
            multiple
            accept={IMAGE_ACCEPT}
            inputId={`image-gallery-${kind}`}
            onFilesSelected={(files) => void uploadFiles(files)}
            className="[&_[role=button]]:min-h-0 [&_[role=button]]:rounded-lg [&_[role=button]]:border-outline-variant [&_[role=button]]:bg-surface-container-lowest [&_[role=button]]:p-6 [&_[role=button]]:text-left"
          >
            <span
              className="block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
              aria-label={dropzoneAriaLabel(kind)}
            >
              Upload images
            </span>
            <span className="mt-2 block font-body text-sm text-on-surface-variant">
              Drop files here or click to choose. JPEG, PNG, WebP, and GIF up to 10 MB each.
            </span>
          </FileUploadTrigger>
          <FileUploadTrigger
            disabled={disabled}
            accept={IMAGE_ACCEPT}
            capture="environment"
            inputId={`image-gallery-camera-${kind}`}
            onFilesSelected={(files) => void uploadFiles(files)}
            className="sm:hidden"
          >
            Take photo
          </FileUploadTrigger>
        </div>
      ) : (
        <p className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4 font-body text-sm text-on-surface-variant">
          Maximum of {maxFiles} images reached. Remove an image before uploading another.
        </p>
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

      {value.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={entries.map((entry, index) => imageEntrySortId(entry, index))}
            strategy={rectSortingStrategy}
          >
            <ol className="grid gap-4 sm:grid-cols-2">
              {entries.map((entry, index) => {
                const primary = index === 0;
                const sortId = imageEntrySortId(entry, index);
                return (
                  <SortableImageCard
                    key={sortId}
                    id={sortId}
                    src={displaySrc(entry.key)}
                    index={index}
                    label={label}
                    imageAlt={primary ? `Primary ${label.toLowerCase()}` : `${label} ${index + 1}`}
                    dragAriaLabel={`Drag ${label.toLowerCase()} ${index + 1}`}
                    onMakePrimary={() => makePrimary(index)}
                    onRemove={() => removeAt(index)}
                  />
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

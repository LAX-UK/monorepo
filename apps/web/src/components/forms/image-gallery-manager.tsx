"use client";

import type { ImageUploadKind } from "@/components/forms/image-upload-field";
import { SortableImageCard } from "@/components/forms/sortable-image-card";
import { UploadItem } from "@/components/forms/upload-item";
import { type KeyEntry, useImageReorder } from "@/lib/forms/image/use-image-reorder";
import { useUploadGallery } from "@/lib/forms/image/use-upload-gallery";
import { notify } from "@/lib/ui/notify";
import { EmptyState } from "@auction/ui/components/empty-state";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useRef, useState } from "react";

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
  return keys.map((key) => ({ key }));
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
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
        <button
          type="button"
          disabled={disabled}
          aria-label={dropzoneAriaLabel(kind)}
          className={`w-full rounded-lg border border-dashed p-6 text-left transition ${
            disabled
              ? "cursor-not-allowed opacity-60"
              : dragging
                ? "border-primary bg-primary-container/20"
                : "border-outline-variant bg-surface-container-lowest"
          }`}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragEnter={(event) => {
            if (disabled) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            if (disabled) return;
            event.preventDefault();
            setDragging(false);
            void uploadFiles(event.dataTransfer.files);
          }}
        >
          <span className="block font-label text-xs uppercase tracking-[0.25em] text-secondary">
            Upload images
          </span>
          <span className="mt-2 block font-body text-sm text-on-surface-variant">
            Drop files here or click to choose. JPEG, PNG, WebP, and GIF up to 10 MB each.
          </span>
        </button>
      ) : (
        <p className="rounded-lg border border-outline-variant/20 bg-surface-container-low/40 p-4 font-body text-sm text-on-surface-variant">
          Maximum of {maxFiles} images reached. Remove an image before uploading another.
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
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
          <SortableContext items={value} strategy={rectSortingStrategy}>
            <ol className="grid gap-4 sm:grid-cols-2">
              {value.map((key, index) => {
                const primary = index === 0;
                return (
                  <SortableImageCard
                    key={key}
                    id={key}
                    src={displaySrc(key)}
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

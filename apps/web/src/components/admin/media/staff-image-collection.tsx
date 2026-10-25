"use client";

import { MediaImage } from "@/components/ui/media-image";
import { type UploadGalleryItem, useUploadGallery } from "@/lib/forms/image/use-upload-gallery";
import {
  type CatalogImageUploadKind,
  catalogImageAccept,
  getCatalogImagePolicy,
} from "@/lib/upload/upload-policies.client";
import {
  Field,
  FileDropzone,
  MediaGrid,
  TextInput,
  UploadQueue,
  type UploadQueueItem,
} from "@auction/staff-ui";
import { useMemo } from "react";

export type StaffImageEntry = { key: string; alt?: string };

type Props = {
  kind: CatalogImageUploadKind;
  value: readonly StaffImageEntry[];
  onChange: (next: StaffImageEntry[]) => void;
  /** What one image is called, in lower case: "photo", "cover image". */
  noun: string;
  /** The first image's role, shown on it: "Cover". */
  primaryLabel?: string;
  /** The drop area's action: "Upload photos". */
  uploadLabel: string;
  maxFiles?: number;
  disabled?: boolean;
  /** Each image gets an alt text field under it. */
  withAlt?: boolean;
  /** Signed preview URLs for keys that cannot be shown directly. */
  previewUrlByKey?: Record<string, string>;
};

function toQueueItem(item: UploadGalleryItem): UploadQueueItem | null {
  if (item.status === "done") return null;
  return {
    id: item.id,
    name: item.fileName,
    status:
      item.status === "error" ? "error" : item.status === "validating" ? "processing" : "uploading",
    ...(item.progress !== undefined ? { progress: item.progress } : {}),
    ...(item.status === "error" && item.message ? { error: item.message } : {}),
  };
}

function sizeLimit(kind: CatalogImageUploadKind): string {
  return `${Math.round(getCatalogImagePolicy(kind).maxBytes / 1024 / 1024)} MB`;
}

/**
 * An ordered set of uploaded images on the kit: drop or browse to add, each file's progress and
 * any failure with a retry, then tiles to reorder (drag, arrow keys or the tile's menu) and
 * remove. The first image is the primary one. Optional alt text sits under each tile.
 */
export function StaffImageCollection({
  kind,
  value,
  onChange,
  noun,
  primaryLabel,
  uploadLabel,
  maxFiles = 20,
  disabled = false,
  withAlt = false,
  previewUrlByKey = {},
}: Props) {
  const keys = useMemo(() => value.map((entry) => entry.key), [value]);
  const { items, uploadFiles, retry, dismiss } = useUploadGallery({
    kind,
    value: keys,
    maxFiles,
    onChange: (nextKeys) => {
      const existing = new Map(value.map((entry) => [entry.key, entry]));
      onChange(nextKeys.map((key) => existing.get(key) ?? { key, alt: "" }));
    },
  });

  // The same file can appear twice; its position among equals keeps tile ids stable.
  const tiles = useMemo(() => {
    const seen = new Map<string, number>();
    return value.map((entry) => {
      const n = seen.get(entry.key) ?? 0;
      seen.set(entry.key, n + 1);
      return { ...entry, id: `${entry.key}::${n}` };
    });
  }, [value]);

  const queue = items.map(toQueueItem).filter((item): item is UploadQueueItem => item !== null);
  const remaining = Math.max(0, maxFiles - value.length);
  const formats = getCatalogImagePolicy(kind).accept.includes("video")
    ? "Images or video"
    : "JPEG, PNG or WebP";
  const hint =
    remaining === 0
      ? `${maxFiles} is the most. Remove one to add another.`
      : `${formats}, up to ${sizeLimit(kind)} each. ${remaining} more can be added.`;

  return (
    <div className="flex flex-col gap-3">
      {tiles.length > 0 ? (
        <MediaGrid
          items={tiles}
          noun={noun}
          {...(primaryLabel ? { primaryLabel } : {})}
          disabled={disabled}
          renderPreview={(tile, index) => (
            <MediaImage
              src={previewUrlByKey[tile.key] ?? tile.key}
              alt={tile.alt?.trim() || `${noun} ${index + 1}`}
              label={`${noun} ${index + 1}`}
              imgClassName="size-full object-cover"
              sizes="240px"
            />
          )}
          {...(withAlt
            ? {
                renderDetails: (tile: (typeof tiles)[number], index: number) => (
                  <Field label="Alt text" optional disabled={disabled}>
                    <TextInput
                      size="sm"
                      aria-label={`Alt text for ${noun} ${index + 1}`}
                      value={tile.alt ?? ""}
                      maxLength={500}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(
                          value.map((entry, i) =>
                            i === index ? { ...entry, alt: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </Field>
                ),
              }
            : {})}
          onMove={(from, to) => {
            const next = [...value];
            const [moved] = next.splice(from, 1);
            if (!moved) return;
            next.splice(to, 0, moved);
            onChange(next);
          }}
          onRemove={(index) => onChange(value.filter((_, i) => i !== index))}
        />
      ) : null}
      {queue.length > 0 ? (
        <UploadQueue
          items={queue}
          disabled={disabled}
          onRetry={(id) => void retry(id)}
          onDismiss={dismiss}
        />
      ) : null}
      <FileDropzone
        label={uploadLabel}
        accept={catalogImageAccept(kind)}
        multiple={maxFiles > 1}
        disabled={disabled || remaining === 0}
        compact={tiles.length > 0}
        hint={hint}
        onFiles={(files) => void uploadFiles(files)}
      />
    </div>
  );
}

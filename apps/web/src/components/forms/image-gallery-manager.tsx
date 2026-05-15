"use client";

import { ImageUploadField, type ImageUploadKind } from "@/components/forms/image-upload-field";
import { SortableImageCard } from "@/components/forms/sortable-image-card";
import { type KeyEntry, useImageReorder } from "@/lib/forms/image/use-image-reorder";
import { EmptyState } from "@auction/ui/components/empty-state";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  kind: ImageUploadKind;
  /** Shown on thumbnails / placeholders */
  label: string;
  maxFiles?: number;
  emptyTitle?: string;
  emptyDescription?: string;
};

function toEntries(keys: string[]): KeyEntry[] {
  return keys.map((key) => ({ key }));
}

export function ImageGalleryManager({
  value,
  onChange,
  kind,
  label,
  maxFiles = 20,
  emptyTitle = "No images yet",
  emptyDescription = "Upload images, then drag to reorder. The first image is the primary.",
}: Props) {
  const entries = toEntries(value);
  const { sensors, onDragEnd } = useImageReorder({
    value: entries,
    onChange: (next) => onChange(next.map((e) => e.key)),
  });
  const remaining = Math.max(0, maxFiles - value.length);

  const makePrimary = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    onChange([item, ...next]);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {remaining > 0 ? (
        <ImageUploadField
          kind={kind}
          multiple
          maxFiles={remaining}
          value={[]}
          onChange={(uploaded) => {
            const nextUploads = uploaded.filter((key) => !value.includes(key));
            if (nextUploads.length > 0) onChange([...value, ...nextUploads]);
          }}
        />
      ) : (
        <p className="rounded-lg border border-outline-variant/20 bg-surface-container-low/40 p-4 font-body text-sm text-on-surface-variant">
          Maximum of {maxFiles} images reached. Remove an image before uploading another.
        </p>
      )}

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

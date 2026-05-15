"use client";

import { SortableImageItem } from "@/components/admin/sortable-image-item";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { type ReorderableImageEntry, useImageReorder } from "@/lib/forms/image/use-image-reorder";
import { EmptyState } from "@auction/ui/components/empty-state";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

export type LotImageEntry = ReorderableImageEntry;

type Props = {
  value: LotImageEntry[];
  onChange: (next: LotImageEntry[]) => void;
  maxFiles?: number;
};

export function LotImageManager({ value, onChange, maxFiles = 20 }: Props) {
  const { sensors, onDragEnd } = useImageReorder({ value, onChange });
  const remaining = Math.max(0, maxFiles - value.length);

  const updateAt = (index: number, patch: Partial<LotImageEntry>) => {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const makePrimary = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    onChange([item, ...next]);
  };

  return (
    <div className="space-y-4">
      {remaining > 0 ? (
        <ImageUploadField
          kind="lot_image"
          multiple
          maxFiles={remaining}
          value={[]}
          onChange={(uploaded) => {
            const nextUploads = uploaded
              .filter((key) => !value.some((item) => item.key === key))
              .map((key) => ({ key, alt: "" }));
            if (nextUploads.length > 0) onChange([...value, ...nextUploads]);
          }}
        />
      ) : (
        <p className="rounded-lg border border-outline-variant/20 bg-surface-container-low/40 p-4 font-body text-sm text-on-surface-variant">
          Maximum of {maxFiles} lot images reached. Remove an image before uploading another.
        </p>
      )}

      {value.length === 0 ? (
        <EmptyState
          title="No lot images yet"
          description="Upload catalog images, then drag to reorder. The first image is the primary artwork image."
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.map((item) => item.key)} strategy={rectSortingStrategy}>
            <ol className="grid gap-4 sm:grid-cols-2">
              {value.map((item, index) => (
                <SortableImageItem
                  key={item.key}
                  item={item}
                  index={index}
                  onAltChange={(alt) => updateAt(index, { alt })}
                  onMakePrimary={() => makePrimary(index)}
                  onRemove={() => removeAt(index)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

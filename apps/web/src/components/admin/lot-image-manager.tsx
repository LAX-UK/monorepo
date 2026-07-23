"use client";

import {
  CatalogMediaAddPanel,
  CatalogMediaDropzone,
  CatalogMediaInspector,
  CatalogMediaUploadQueue,
  MediaReorderLiveRegion,
  useMediaReorderAnnouncement,
} from "@/components/admin/catalog/media";
import { SortableImageItem } from "@/components/admin/sortable-image-item";
import { MediaImage } from "@/components/ui/media-image";
import {
  type ReorderableImageEntry,
  imageEntrySortId,
  useImageReorder,
} from "@/lib/forms/image/use-image-reorder";
import { useUploadGallery } from "@/lib/forms/image/use-upload-gallery";
import { notify } from "@/lib/ui/notify";
import { catalogImageAccept, catalogImageHelperCopy } from "@/lib/upload/upload-policies.client";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { DndContext, type DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useId, useRef } from "react";

export type LotImageEntry = ReorderableImageEntry;

type Props = {
  value: LotImageEntry[];
  onChange: (next: LotImageEntry[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  showAddPanel?: boolean;
  onCloseAddPanel?: () => void;
  showManage?: boolean;
  inspectIndex?: number | null;
  onInspectIndex?: (index: number | null) => void;
};

export function LotImageManager({
  value,
  onChange,
  maxFiles = 50,
  disabled = false,
  showAddPanel = false,
  onCloseAddPanel,
  showManage = false,
  inspectIndex = null,
  onInspectIndex,
}: Props) {
  const addPanelRef = useRef<HTMLDivElement>(null);
  const previousLengthRef = useRef(value.length);
  const altInputId = useId();
  const { message, announceMove } = useMediaReorderAnnouncement();
  const { sensors, onDragEnd: baseOnDragEnd } = useImageReorder({ value, onChange });
  const remaining = Math.max(0, maxFiles - value.length);
  const keys = value.map((item) => item.key);
  const isEmpty = value.length === 0;
  const showDropzone = isEmpty || showAddPanel;

  const {
    items: uploadItems,
    uploadFiles,
    retry,
  } = useUploadGallery({
    kind: "lot_image",
    value: keys,
    maxFiles,
    onChange: (nextKeys) => {
      const existing = new Map(value.map((item) => [item.key, item]));
      onChange(nextKeys.map((key) => existing.get(key) ?? { key, alt: "" }));
    },
    onError: (message) => notify.error("Upload failed", { description: message }),
  });

  useEffect(() => {
    if (showAddPanel && addPanelRef.current) {
      const focusTarget = addPanelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusTarget?.focus();
    }
  }, [showAddPanel]);

  useEffect(() => {
    if (showAddPanel && value.length > previousLengthRef.current) {
      onCloseAddPanel?.();
    }
    previousLengthRef.current = value.length;
  }, [value.length, showAddPanel, onCloseAddPanel]);

  const updateAt = (index: number, patch: Partial<LotImageEntry>) => {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    if (inspectIndex === index) onInspectIndex?.(null);
    else if (inspectIndex !== null && inspectIndex !== undefined && inspectIndex > index) {
      onInspectIndex?.(inspectIndex - 1);
    }
  };

  const makePrimary = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    onChange([item, ...next]);
    if (inspectIndex === index) onInspectIndex?.(0);
    else if (inspectIndex !== null && inspectIndex !== undefined && inspectIndex > index) {
      onInspectIndex?.(inspectIndex - 1);
    }
  };

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
    announceMove(`image ${index + 1}`, index, target);
    if (inspectIndex === index) onInspectIndex?.(target);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = value.findIndex((item, i) => imageEntrySortId(item, i) === active.id);
      const newIndex = value.findIndex((item, i) => imageEntrySortId(item, i) === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        announceMove(`image ${oldIndex + 1}`, oldIndex, newIndex);
        if (inspectIndex === oldIndex) onInspectIndex?.(newIndex);
      }
    }
    baseOnDragEnd(event);
  };

  const uploadQueue = (
    <CatalogMediaUploadQueue
      items={uploadItems}
      disabled={disabled}
      onRetry={(itemId) => void retry(itemId)}
    />
  );

  const dropzone =
    remaining > 0 ? (
      <CatalogMediaDropzone
        inputId="lot-image-upload"
        title={isEmpty ? "Add catalogue images" : "Add more images"}
        description={catalogImageHelperCopy("lot_image", remaining)}
        accept={catalogImageAccept("lot_image")}
        disabled={disabled}
        compact={!isEmpty}
        onFilesSelected={(files) => void uploadFiles(files)}
        queue={uploadQueue}
      />
    ) : (
      <p className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4 font-body text-sm text-on-surface-variant">
        Maximum of {maxFiles} lot images reached. Remove an image before uploading another.
      </p>
    );

  const inspectedItem =
    inspectIndex !== null && inspectIndex !== undefined ? value[inspectIndex] : null;

  return (
    <div className="space-y-5">
      <MediaReorderLiveRegion message={message} />

      {showDropzone ? (
        isEmpty ? (
          dropzone
        ) : (
          <CatalogMediaAddPanel
            panelRef={addPanelRef}
            title="Add images"
            description="Upload additional catalogue images. The first image remains the hero unless you reorder."
            onCancel={() => onCloseAddPanel?.()}
          >
            {dropzone}
          </CatalogMediaAddPanel>
        )
      ) : null}

      {isEmpty && !showDropzone ? null : isEmpty ? (
        <p className="text-center font-body text-sm text-on-surface-variant">
          The first uploaded image becomes the catalogue hero. You can reorder it later.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={value.map((item, index) => imageEntrySortId(item, index))}
            strategy={rectSortingStrategy}
          >
            <ol className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {value.map((item, index) => (
                <SortableImageItem
                  key={imageEntrySortId(item, index)}
                  item={item}
                  sortId={imageEntrySortId(item, index)}
                  index={index}
                  onMakePrimary={() => makePrimary(index)}
                  onRemove={() => removeAt(index)}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                  onOpenInspector={() => onInspectIndex?.(index)}
                  isLast={index === value.length - 1}
                  disabled={disabled}
                  showManage={showManage}
                  isSelected={inspectIndex === index}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {inspectedItem && inspectIndex !== null && inspectIndex !== undefined ? (
        <CatalogMediaInspector
          open
          onOpenChange={(open) => {
            if (!open) onInspectIndex?.(null);
          }}
          title={`Image ${inspectIndex + 1} details`}
          description="Alt text helps screen readers and search engines understand this artwork image."
          preview={
            <MediaImage
              src={inspectedItem.key}
              alt={inspectedItem.alt || `Lot image ${inspectIndex + 1}`}
              label={`Lot image ${inspectIndex + 1}`}
              imgClassName="size-full object-cover"
              sizes="320px"
            />
          }
        >
          <div>
            <Label htmlFor={altInputId}>Alt text</Label>
            <Input
              id={altInputId}
              value={inspectedItem.alt}
              onChange={(event) => updateAt(inspectIndex, { alt: event.target.value })}
              maxLength={500}
              placeholder="Describe the artwork image for screen readers"
              className="mt-1 min-h-11 text-sm"
              disabled={disabled}
            />
          </div>
          {inspectIndex === 0 ? (
            <p className="font-body text-xs text-on-surface-variant">
              This image is the catalogue hero and appears first in public listings.
            </p>
          ) : null}
        </CatalogMediaInspector>
      ) : null}
    </div>
  );
}

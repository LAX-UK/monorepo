"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { MediaImage } from "@/components/ui/media-image";
import {
  type KeyEntry,
  imageEntrySortId,
  useImageReorder,
} from "@/lib/forms/image/use-image-reorder";
import { useUploadGallery } from "@/lib/forms/image/use-upload-gallery";
import { notify } from "@/lib/ui/notify";
import type { CatalogImageUploadKind } from "@/lib/upload/upload-policies.client";
import {
  catalogImageAccept,
  catalogImageHelperCopy,
  getCatalogImagePolicy,
} from "@/lib/upload/upload-policies.client";
import type { DragEndEvent } from "@dnd-kit/core";
import { useEffect, useRef } from "react";
import { CatalogMediaAddPanel } from "./catalog-media-add-panel";
import { CatalogMediaDropzone } from "./catalog-media-dropzone";
import { CatalogMediaInspector } from "./catalog-media-inspector";
import { CatalogMediaUploadQueue } from "./catalog-media-upload-queue";
import { CatalogOrderedImageGrid } from "./catalog-ordered-image-grid";
import { MediaReorderLiveRegion } from "./media-reorder-live-region";
import { useMediaReorderAnnouncement } from "./use-media-reorder-announcement";

type Props = {
  kind: CatalogImageUploadKind;
  value: string[];
  onChange: (next: string[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  previewUrlByKey?: Record<string, string>;
  imageLabel?: string;
  primaryLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  showAddPanel?: boolean;
  onCloseAddPanel?: () => void;
  showManage?: boolean;
  inspectIndex?: number | null;
  onInspectIndex?: (index: number | null) => void;
};

function toEntries(keys: string[]): KeyEntry[] {
  const occurrences = new Map<string, number>();
  return keys.map((key) => {
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return { key, sortId: `${key}::${occurrence}` };
  });
}

/** Ordered image collection with shared upload, reorder, and progressive disclosure. */
export function CatalogOrderedImageCollection({
  kind,
  value,
  onChange,
  maxFiles = 20,
  disabled = false,
  previewUrlByKey = {},
  imageLabel = "Image",
  primaryLabel = "Primary",
  emptyTitle = "No images yet",
  emptyDescription = "Upload images, then drag to reorder. The first image is primary.",
  showAddPanel = false,
  onCloseAddPanel,
  showManage = false,
  inspectIndex = null,
  onInspectIndex,
}: Props) {
  const addPanelRef = useRef<HTMLDivElement>(null);
  const previousLengthRef = useRef(value.length);
  const policy = getCatalogImagePolicy(kind);
  const { message, announceMove } = useMediaReorderAnnouncement();
  const entries = toEntries(value);
  const { sensors, onDragEnd: baseOnDragEnd } = useImageReorder({
    value: entries,
    onChange: (next) => onChange(next.map((entry) => entry.key)),
  });
  const remaining = Math.max(0, maxFiles - value.length);
  const isEmpty = value.length === 0;
  const showDropzone = isEmpty || showAddPanel;

  const {
    items: uploadItems,
    uploadFiles,
    retry,
  } = useUploadGallery({
    kind,
    value,
    maxFiles,
    onChange,
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

  const makePrimary = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    onChange([item, ...next]);
    if (inspectIndex === index) onInspectIndex?.(0);
    else if (inspectIndex !== null && inspectIndex > index) onInspectIndex?.(inspectIndex - 1);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    if (inspectIndex === index) onInspectIndex?.(null);
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
    announceMove(`${imageLabel.toLowerCase()} ${index + 1}`, index, target);
    if (inspectIndex === index) onInspectIndex?.(target);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = entries.findIndex((entry, i) => imageEntrySortId(entry, i) === active.id);
      const newIndex = entries.findIndex((entry, i) => imageEntrySortId(entry, i) === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        announceMove(`${imageLabel.toLowerCase()} ${oldIndex + 1}`, oldIndex, newIndex);
        if (inspectIndex === oldIndex) onInspectIndex?.(newIndex);
      }
    }
    baseOnDragEnd(event);
  };

  const displaySrc = (key: string) => previewUrlByKey[key] ?? key;
  const inspectedKey =
    inspectIndex !== null && inspectIndex !== undefined ? value[inspectIndex] : null;

  const dropzone =
    remaining > 0 ? (
      <CatalogMediaDropzone
        inputId={`ordered-image-${kind}`}
        title={isEmpty ? policy.dropzoneTitle : `Add more ${imageLabel.toLowerCase()}s`}
        description={catalogImageHelperCopy(kind, remaining)}
        accept={catalogImageAccept(kind)}
        disabled={disabled}
        compact={!isEmpty}
        onFilesSelected={(files) => void uploadFiles(files)}
        queue={
          <CatalogMediaUploadQueue
            items={uploadItems}
            disabled={disabled}
            onRetry={(itemId) => void retry(itemId)}
          />
        }
      />
    ) : (
      <p className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4 font-body text-sm text-on-surface-variant">
        Maximum of {maxFiles} images reached. Remove an image before uploading another.
      </p>
    );

  return (
    <div className="space-y-5">
      <MediaReorderLiveRegion message={message} />

      {showDropzone ? (
        isEmpty ? (
          dropzone
        ) : (
          <CatalogMediaAddPanel
            panelRef={addPanelRef}
            title={`Add ${imageLabel.toLowerCase()}s`}
            description={`Upload additional images. The first image remains ${primaryLabel.toLowerCase()} unless you reorder.`}
            onCancel={() => onCloseAddPanel?.()}
          >
            {dropzone}
          </CatalogMediaAddPanel>
        )
      ) : null}

      {isEmpty ? (
        showDropzone ? (
          <p className="text-center font-body text-sm text-on-surface-variant">
            {emptyDescription}
          </p>
        ) : (
          <AdminEmptyState title={emptyTitle} description={emptyDescription} />
        )
      ) : (
        <CatalogOrderedImageGrid
          entries={entries}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          displaySrc={displaySrc}
          imageLabel={imageLabel}
          primaryLabel={primaryLabel}
          disabled={disabled}
          showManage={showManage}
          inspectIndex={inspectIndex}
          {...(onInspectIndex ? { onInspectIndex } : {})}
          onMakePrimary={makePrimary}
          onRemove={removeAt}
          onMove={move}
        />
      )}

      {inspectedKey && inspectIndex !== null && inspectIndex !== undefined ? (
        <CatalogMediaInspector
          open
          onOpenChange={(open) => {
            if (!open) onInspectIndex?.(null);
          }}
          title={`${imageLabel} ${inspectIndex + 1}`}
          description={
            inspectIndex === 0
              ? `This is the ${primaryLabel.toLowerCase()} and appears first in listings.`
              : `Position ${inspectIndex + 1} in the collection.`
          }
          preview={
            <MediaImage
              src={displaySrc(inspectedKey)}
              alt={`${imageLabel} ${inspectIndex + 1}`}
              label={imageLabel}
              imgClassName="size-full object-cover"
              sizes="320px"
            />
          }
        >
          <p className="font-body text-sm text-on-surface-variant">Preview only.</p>
        </CatalogMediaInspector>
      ) : null}
    </div>
  );
}

"use client";

import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { ConfirmedRemoveButton } from "@/components/admin/confirmed-remove-button";
import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import { notify } from "@/lib/ui/notify";
import type { SaleDayMediaRef } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { FileUploadTrigger } from "@auction/ui/components/file-upload-trigger";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, InfoIcon, PlayCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

const ACCEPT_ALL = "image/jpeg,image/png,image/webp,video/mp4,video/webm";
const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp";
const ACCEPT_VIDEOS = "video/mp4,video/webm";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayMediaItem = {
  id: string; // === key for saved items; temp id for uploading
  key: string;
  mediaType: "image" | "video";
  /** Resolved preview URL for thumbnails. */
  previewUrl: string;
  caption: string;
  /** Alt text (images only). */
  alt: string;
  uploading?: boolean;
  uploadError?: string;
};

// ─── Sortable card ─────────────────────────────────────────────────────────────

function DayMediaCard({
  item,
  index,
  disabled,
  removeConfirmTitle,
  removeConfirmBody,
  onRemoveConfirmed,
  onCaptionChange,
  onAltChange,
}: {
  item: DayMediaItem;
  index: number;
  disabled: boolean;
  removeConfirmTitle: string;
  removeConfirmBody: string;
  onRemoveConfirmed: () => Promise<void>;
  onCaptionChange: (v: string) => void;
  onAltChange: (v: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex gap-3 rounded-lg border border-border-hairline bg-surface-container-lowest p-3"
    >
      {/* Drag handle */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-on-surface-variant/50 hover:text-on-surface-variant active:cursor-grabbing"
        aria-label="Drag to reorder"
        disabled={disabled}
      >
        <GripVerticalIcon className="size-4" aria-hidden />
      </Button>

      {/* Thumbnail */}
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-container-low">
        {item.uploading ? (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-label text-[10px] text-on-surface-variant">Uploading…</span>
          </div>
        ) : item.mediaType === "video" ? (
          <>
            {item.previewUrl ? (
              <video
                src={item.previewUrl}
                className="h-full w-full object-cover"
                preload="metadata"
                muted
                aria-label={`Video ${index + 1} thumbnail`}
              >
                {/* Decorative thumbnail — captions not applicable */}
                <track kind="captions" srcLang="en" label="" />
              </video>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface-container">
                <PlayCircleIcon className="size-7 text-on-surface-variant/50" aria-hidden />
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <PlayCircleIcon className="size-5 drop-shadow-md text-white" />
            </div>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- dashboard thumbnail, no next/image needed
          <img
            src={item.previewUrl || undefined}
            alt={item.alt || `Photo ${index + 1}`}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* Meta inputs */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          {item.mediaType === "video" ? `Video ${index + 1}` : `Photo ${index + 1}`}
        </p>
        {item.uploadError ? (
          <p className="font-body text-xs text-error">{item.uploadError}</p>
        ) : null}
        <input
          type="text"
          placeholder="Caption (optional)"
          maxLength={280}
          value={item.caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          disabled={disabled || item.uploading}
          className="block w-full rounded-md border border-outline-variant/40 bg-surface px-2.5 py-1.5 font-body text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        {item.mediaType === "image" ? (
          <input
            type="text"
            placeholder="Alt text (for SEO & accessibility)"
            maxLength={280}
            value={item.alt}
            onChange={(e) => onAltChange(e.target.value)}
            disabled={disabled || item.uploading}
            className="block w-full rounded-md border border-outline-variant/40 bg-surface px-2.5 py-1.5 font-body text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        ) : null}
      </div>

      <ConfirmedRemoveButton
        ariaLabel={`Remove item ${index + 1}`}
        confirmTitle={removeConfirmTitle}
        confirmBody={removeConfirmBody}
        disabled={Boolean(disabled || item.uploading)}
        loading={Boolean(disabled)}
        onConfirmed={onRemoveConfirmed}
      />
    </li>
  );
}

// ─── Main tab component ────────────────────────────────────────────────────────

type Props = {
  saleId: string;
  saleStatus: string;
  initialDayImages: SaleDayMediaRef[];
  previewUrlByKey: Record<string, string>;
  canManage: boolean;
};

function refToItem(ref: SaleDayMediaRef, previewUrlByKey: Record<string, string>): DayMediaItem {
  const mediaType = ref.mediaType === "video" ? "video" : "image";
  return {
    id: ref.key,
    key: ref.key,
    mediaType,
    previewUrl: previewUrlByKey[ref.key] ?? ref.key,
    caption: ref.caption ?? "",
    alt: ref.mediaType !== "video" && ref.alt ? ref.alt : "",
  };
}

function itemsToDayImages(items: DayMediaItem[]): SaleDayMediaRef[] {
  return items
    .filter((it) => it.key && !it.uploadError)
    .map((it) => {
      if (it.mediaType === "video") {
        const ref: import("@auction/types").SaleDayVideoRef = { mediaType: "video", key: it.key };
        if (it.caption.trim()) ref.caption = it.caption.trim();
        return ref;
      }
      const ref: import("@auction/types").SaleDayPhotoRef = { key: it.key };
      if (it.caption.trim()) ref.caption = it.caption.trim();
      if (it.alt.trim()) ref.alt = it.alt.trim();
      return ref;
    });
}

export function SaleDayPhotosTab({
  saleId,
  saleStatus,
  initialDayImages,
  previewUrlByKey,
  canManage,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<DayMediaItem[]>(() =>
    initialDayImages.map((r) => refToItem(r, previewUrlByKey)),
  );
  const [saving, setSaving] = useState(false);
  const { uploadFile } = useUploadObjectLifecycle();
  const isEnded = saleStatus === "ended";

  const savedRef = useRef<string>(
    JSON.stringify(initialDayImages.map((r) => refToItem(r, previewUrlByKey))),
  );
  const dirty = JSON.stringify(items) !== savedRef.current;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Upload handler ──────────────────────────────────────────────────────────
  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      for (const file of arr) {
        const tempId = `uploading-${Date.now()}-${file.name}`;
        const mediaType: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
        setItems((prev) => [
          ...prev,
          { id: tempId, key: "", mediaType, previewUrl: "", caption: "", alt: "", uploading: true },
        ]);
        try {
          const uploaded = await uploadFile(file, "sale_day");
          const objectUrl = URL.createObjectURL(file);
          setItems((prev) =>
            prev.map((it) =>
              it.id === tempId
                ? {
                    id: uploaded.key,
                    key: uploaded.key,
                    mediaType,
                    previewUrl: objectUrl,
                    caption: "",
                    alt: "",
                    uploading: false,
                  }
                : it,
            ),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          setItems((prev) =>
            prev.map((it) =>
              it.id === tempId ? { ...it, uploading: false, uploadError: message } : it,
            ),
          );
          notify.error("Upload failed", { description: message });
        }
      }
    },
    [uploadFile],
  );

  // ── Persist ─────────────────────────────────────────────────────────────────
  const persistDayImages = useCallback(
    async (nextItems: DayMediaItem[]): Promise<boolean> => {
      const pending = nextItems.filter((it) => it.uploading);
      if (pending.length > 0) {
        notify.error("Please wait for uploads to finish before saving.");
        return false;
      }
      if (!isEnded) {
        return true;
      }
      setSaving(true);
      try {
        const result = await adminUpdateSaleResultAction(saleId, {
          dayImages: itemsToDayImages(nextItems),
        });
        if (result.ok) {
          savedRef.current = JSON.stringify(nextItems);
          router.refresh();
          return true;
        }
        notify.error("Save failed", {
          description: !result.ok && result.error ? result.error : "Please try again.",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [isEnded, router, saleId],
  );

  const handleSave = useCallback(async () => {
    const ok = await persistDayImages(items);
    if (ok && isEnded) {
      notify.success("Auction day media saved");
    }
  }, [isEnded, items, persistDayImages]);

  const handleRemoveConfirmed = useCallback(
    async (itemId: string) => {
      if (saving) return;
      const next = items.filter((it) => it.id !== itemId);
      if (!isEnded || !canManage) {
        setItems(next);
        return;
      }
      const ok = await persistDayImages(next);
      if (!ok) return;
      setItems(next);
      notify.success("Media removed");
    },
    [canManage, isEnded, items, persistDayImages, saving],
  );

  const anyUploading = items.some((it) => it.uploading);

  return (
    <CatalogDetailTabPanel
      title="Auction day media"
      description="Upload event photos and short video clips from the saleroom floor. Once the sale has ended, removing an item saves immediately; use Save media for caption or order changes."
      framed={false}
    >
      {!isEnded ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-border-hairline bg-amber-500/10 p-4">
          <InfoIcon
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <p className="font-body text-sm text-on-surface-variant">
            Auction day media can only be saved after the sale has ended. You can upload files now
            to prepare them, but the <strong>Save media</strong> button will become active once the
            sale status changes to ended.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
        {/* Upload triggers */}
        {canManage ? (
          <div className="mb-5 flex flex-wrap gap-3">
            <FileUploadTrigger
              dropzone
              disabled={saving || anyUploading}
              multiple
              accept={ACCEPT_ALL}
              inputId="sale-day-media-all"
              onFilesSelected={(files) => void uploadFiles(files)}
              className="[&_[role=button]]:min-h-0 [&_[role=button]]:rounded-lg [&_[role=button]]:border-outline-variant [&_[role=button]]:bg-surface-container-lowest [&_[role=button]]:px-5 [&_[role=button]]:py-4 [&_[role=button]]:text-left"
            >
              <span className="block font-label text-xs uppercase tracking-[0.22em] text-secondary">
                Upload photos &amp; videos
              </span>
              <span className="mt-1 block font-body text-sm text-on-surface-variant">
                JPEG, PNG, WebP, MP4, WebM — drop here or click to choose
              </span>
            </FileUploadTrigger>
            <FileUploadTrigger
              disabled={saving || anyUploading}
              accept={ACCEPT_IMAGES}
              capture="environment"
              inputId="sale-day-media-camera"
              onFilesSelected={(files) => void uploadFiles(files)}
              className="sm:hidden"
            >
              Take photo
            </FileUploadTrigger>
            <FileUploadTrigger
              disabled={saving || anyUploading}
              accept={ACCEPT_VIDEOS}
              capture="environment"
              inputId="sale-day-media-video"
              onFilesSelected={(files) => void uploadFiles(files)}
              className="sm:hidden"
            >
              Record video
            </FileUploadTrigger>
          </div>
        ) : null}

        {/* List */}
        {items.length === 0 ? (
          <EmptyState
            title="No auction day media yet"
            description="Upload photos and short video clips from the event, then drag to reorder."
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (over && active.id !== over.id) {
                setItems((prev) => {
                  const from = prev.findIndex((it) => it.id === active.id);
                  const to = prev.findIndex((it) => it.id === over.id);
                  return arrayMove(prev, from, to);
                });
              }
            }}
          >
            <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
              <ol className="space-y-2 list-none p-0" aria-live="polite">
                {items.map((item, index) => (
                  <DayMediaCard
                    key={item.id}
                    item={item}
                    index={index}
                    disabled={!canManage || saving}
                    removeConfirmTitle={
                      isEnded ? "Remove from public gallery?" : "Remove from draft list?"
                    }
                    removeConfirmBody={
                      isEnded
                        ? "Remove this item from the public gallery? This cannot be undone."
                        : "Remove this item from your draft list? You can re-upload before the sale ends."
                    }
                    onRemoveConfirmed={() => handleRemoveConfirmed(item.id)}
                    onCaptionChange={(v) =>
                      setItems((prev) =>
                        prev.map((it) => (it.id === item.id ? { ...it, caption: v } : it)),
                      )
                    }
                    onAltChange={(v) =>
                      setItems((prev) =>
                        prev.map((it) => (it.id === item.id ? { ...it, alt: v } : it)),
                      )
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {canManage ? (
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-hairline pt-5">
            <p className="font-body text-xs text-on-surface-variant">
              {items.length} item{items.length !== 1 ? "s" : ""}
              {anyUploading ? " · Uploading…" : ""}
              {dirty && isEnded && !saving ? " · Unsaved changes" : ""}
              {saving ? " · Saving…" : ""}
            </p>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || !dirty || anyUploading || !isEnded}
              variant="cta"
              size="sm"
              title={!isEnded ? "Available once the sale has ended" : undefined}
            >
              {saving ? "Saving…" : "Save media"}
            </Button>
          </div>
        ) : null}
      </div>
    </CatalogDetailTabPanel>
  );
}

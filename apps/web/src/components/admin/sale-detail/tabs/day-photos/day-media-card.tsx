"use client";

import { CatalogMediaCard, CatalogMediaManageActions } from "@/components/admin/catalog/media";
import { MediaImage } from "@/components/ui/media-image";
import { Button } from "@auction/ui/components/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlayCircleIcon } from "lucide-react";
import type { DayMediaItem } from "./day-media-types";

export function DayMediaCard({
  item,
  index,
  showManage,
  published,
  disabled,
  isLast,
  isSelected,
  removeConfirmTitle,
  removeConfirmBody,
  onRemoveConfirmed,
  onOpenInspector,
  onMoveUp,
  onMoveDown,
}: {
  item: DayMediaItem;
  index: number;
  showManage: boolean;
  published: boolean;
  disabled: boolean;
  isLast: boolean;
  isSelected?: boolean;
  removeConfirmTitle: string;
  removeConfirmBody: string;
  onRemoveConfirmed: () => Promise<void>;
  onOpenInspector: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: disabled || !showManage,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const captionPreview = item.caption.trim();
  const typeLabel = item.mediaType === "video" ? "Video" : "Photo";

  return (
    <CatalogMediaCard
      ref={setNodeRef}
      style={style}
      className={isDragging ? "border-primary ring-2 ring-primary/20" : undefined}
      {...(isSelected ? { isSelected: true } : {})}
      {...(disabled || item.uploading ? {} : { onOpen: onOpenInspector })}
      media={
        item.uploading ? (
          <div className="flex size-full items-center justify-center">
            <span className="font-label text-xs text-on-surface-variant">Uploading…</span>
          </div>
        ) : item.mediaType === "video" ? (
          <div className="relative size-full">
            {item.previewUrl ? (
              <video
                src={item.previewUrl}
                className="size-full object-cover"
                preload="metadata"
                muted
                aria-label={`Video ${index + 1} thumbnail`}
              >
                <track kind="captions" srcLang="en" label="" />
              </video>
            ) : (
              <div className="flex size-full items-center justify-center bg-surface-container">
                <PlayCircleIcon className="size-7 text-on-surface-variant/50" aria-hidden />
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <PlayCircleIcon className="size-5 drop-shadow-md text-white" />
            </div>
          </div>
        ) : (
          <MediaImage
            src={item.previewUrl}
            alt={item.alt || `Photo ${index + 1}`}
            label={captionPreview || `Photo ${index + 1}`}
            imgClassName="size-full object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
          />
        )
      }
      title={captionPreview || (item.mediaType === "video" ? "Video clip" : `Photo ${index + 1}`)}
      subtitle={
        item.uploadError ??
        (item.alt.trim() && item.mediaType === "image"
          ? item.alt.trim()
          : item.mediaType === "video"
            ? "Video"
            : "Image")
      }
      orderLabel={`${typeLabel} ${index + 1}`}
      badge={
        <span className="rounded-full bg-surface-container-lowest/95 px-2 py-1 font-label text-[10px] font-semibold uppercase tracking-wide text-on-surface shadow-sm">
          {published ? "Published" : "Draft"}
        </span>
      }
      actions={
        showManage ? (
          <CatalogMediaManageActions
            index={index}
            isLast={isLast}
            disabled={disabled || item.uploading}
            dragAttributes={attributes}
            dragListeners={listeners}
            dragAriaLabel={`Drag media item ${index + 1} to reorder`}
            moveEarlierAriaLabel={`Move media item ${index + 1} earlier`}
            moveLaterAriaLabel={`Move media item ${index + 1} later`}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onEditDetails={onOpenInspector}
            editDetailsAriaLabel={`Edit details for media item ${index + 1}`}
            removeAriaLabel={`Remove item ${index + 1}`}
            removeConfirmTitle={removeConfirmTitle}
            removeConfirmBody={removeConfirmBody}
            onRemoveConfirmed={onRemoveConfirmed}
            removeLoading={disabled}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenInspector}
            disabled={disabled || item.uploading}
          >
            Edit details
          </Button>
        )
      }
    >
      {item.uploadError ? (
        <p className="font-body text-xs text-error" role="alert">
          {item.uploadError}
        </p>
      ) : null}
    </CatalogMediaCard>
  );
}

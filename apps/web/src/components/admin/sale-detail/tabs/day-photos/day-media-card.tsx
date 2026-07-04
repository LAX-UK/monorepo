"use client";

import { ConfirmedRemoveButton } from "@/components/admin/confirmed-remove-button";
import { Button } from "@auction/ui/components/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlayCircleIcon } from "lucide-react";
import type { DayMediaItem } from "./day-media-types";

export function DayMediaCard({
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

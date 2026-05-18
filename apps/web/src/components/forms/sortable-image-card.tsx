"use client";

import { MediaImage } from "@/components/ui/media-image";
import { Button } from "@auction/ui/components/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export type SortableImageCardProps = {
  /** Stable id for dnd-kit and image key/URL */
  id: string;
  /** Resolved thumbnail URL; defaults to `id` when omitted. */
  src?: string;
  index: number;
  /** Shown on MediaImage `label` */
  label: string;
  /** Accessible name for the image */
  imageAlt: string;
  /** `aria-label` for the drag handle */
  dragAriaLabel: string;
  onMakePrimary: () => void;
  onRemove: () => void;
  /** Rendered above the action row (e.g. alt text field for lot images) */
  children?: ReactNode;
};

export function SortableImageCard({
  id,
  src,
  index,
  label,
  imageAlt,
  dragAriaLabel,
  onMakePrimary,
  onRemove,
  children,
}: SortableImageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const primary = index === 0;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded-xl border bg-surface-container-lowest p-3 shadow-sm ${
        isDragging ? "border-primary ring-2 ring-primary/20" : "border-border-hairline"
      }`}
    >
      <div className="relative overflow-hidden rounded-lg bg-surface-container-high">
        <MediaImage
          src={src ?? id}
          alt={imageAlt}
          label={label}
          aspect={[1, 1]}
          sizes="(max-width: 640px) 100vw, 280px"
        />
        <div className="absolute left-2 top-2 flex items-center gap-2">
          {primary ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 font-label text-[10px] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary">
              <Star className="size-3" aria-hidden />
              Primary
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface shadow-sm hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={dragAriaLabel}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {children}
        <div className="flex flex-wrap gap-2">
          {!primary ? (
            <Button type="button" variant="secondary" className="min-h-10" onClick={onMakePrimary}>
              Make primary
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="min-h-10 border-error/40 text-error hover:bg-error/10 hover:text-error"
            onClick={onRemove}
          >
            <Trash2 className="mr-2 size-4" aria-hidden />
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

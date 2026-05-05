"use client";

import { MediaImage } from "@/components/ui/media-image";
import type { ReorderableImageEntry } from "@/lib/forms/lot/use-image-reorder";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";
import { useId } from "react";

type Props = {
  item: ReorderableImageEntry;
  index: number;
  onAltChange: (alt: string) => void;
  onMakePrimary: () => void;
  onRemove: () => void;
};

export function SortableImageItem({ item, index, onAltChange, onMakePrimary, onRemove }: Props) {
  const altInputId = useId();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
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
        isDragging ? "border-primary ring-2 ring-primary/20" : "border-outline-variant/20"
      }`}
    >
      <div className="relative overflow-hidden rounded-lg bg-surface-container-high">
        <MediaImage
          src={item.key}
          alt={item.alt || (primary ? "Primary lot image" : `Lot image ${index + 1}`)}
          label={primary ? "Primary lot artwork" : "Lot artwork"}
          aspect={[1, 1]}
          sizes="(max-width: 640px) 100vw, 280px"
        />
        <div className="absolute left-2 top-2 flex items-center gap-2">
          {primary ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-on-primary">
              <Star className="size-3" aria-hidden />
              Primary
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface shadow-sm hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={`Drag lot image ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <label className="block" htmlFor={altInputId}>
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
            Alt text
          </span>
          <Input
            id={altInputId}
            value={item.alt}
            onChange={(event) => onAltChange(event.target.value)}
            maxLength={500}
            placeholder="Describe the artwork image for screen readers"
            className="mt-1 min-h-11 text-sm"
          />
        </label>
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

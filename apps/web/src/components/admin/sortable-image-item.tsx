"use client";

import { SortableImageCard } from "@/components/forms/sortable-image-card";
import type { ReorderableImageEntry } from "@/lib/forms/image/use-image-reorder";
import { Input } from "@auction/ui/components/input";
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
  const primary = index === 0;

  return (
    <SortableImageCard
      id={item.key}
      index={index}
      label={primary ? "Primary lot artwork" : "Lot artwork"}
      imageAlt={item.alt || (primary ? "Primary lot image" : `Lot image ${index + 1}`)}
      dragAriaLabel={`Drag lot image ${index + 1}`}
      onMakePrimary={onMakePrimary}
      onRemove={onRemove}
    >
      <label className="block" htmlFor={altInputId}>
        <span className="font-label text-[10px] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
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
    </SortableImageCard>
  );
}

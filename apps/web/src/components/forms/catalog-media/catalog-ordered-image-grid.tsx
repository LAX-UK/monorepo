"use client";

import {
  type KeyEntry,
  imageEntrySortId,
  type useImageReorder,
} from "@/lib/forms/image/use-image-reorder";
import { DndContext, type DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableKeyImageItem } from "./sortable-key-image-item";

type Props = {
  entries: KeyEntry[];
  sensors: ReturnType<typeof useImageReorder>["sensors"];
  onDragEnd: (event: DragEndEvent) => void;
  displaySrc: (key: string) => string;
  imageLabel: string;
  primaryLabel: string;
  disabled: boolean;
  showManage: boolean;
  inspectIndex: number | null;
  onInspectIndex?: (index: number | null) => void;
  onMakePrimary: (index: number) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, offset: -1 | 1) => void;
};

/** DnD presentation for an ordered image collection; orchestration stays in the parent. */
export function CatalogOrderedImageGrid({
  entries,
  sensors,
  onDragEnd,
  displaySrc,
  imageLabel,
  primaryLabel,
  disabled,
  showManage,
  inspectIndex,
  onInspectIndex,
  onMakePrimary,
  onRemove,
  onMove,
}: Props) {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={entries.map((entry, index) => imageEntrySortId(entry, index))}
        strategy={rectSortingStrategy}
      >
        <ol className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <SortableKeyImageItem
              key={imageEntrySortId(entry, index)}
              sortId={imageEntrySortId(entry, index)}
              src={displaySrc(entry.key)}
              index={index}
              primaryLabel={primaryLabel}
              imageLabel={imageLabel}
              onMakePrimary={() => onMakePrimary(index)}
              onRemove={() => onRemove(index)}
              onMoveUp={() => onMove(index, -1)}
              onMoveDown={() => onMove(index, 1)}
              {...(onInspectIndex ? { onOpen: () => onInspectIndex(index) } : {})}
              isLast={index === entries.length - 1}
              disabled={disabled}
              showManage={showManage}
              isSelected={inspectIndex === index}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

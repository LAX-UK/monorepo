"use client";

import {
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export type KeyEntry = {
  key: string /** Stable unique id for React keys and dnd-kit (required when `key` may repeat). */;
  sortId?: string;
};

export type ReorderableImageEntry = KeyEntry & { alt: string };

/** Unique sortable id; falls back to index + key when the same URL appears more than once. */
export function imageEntrySortId(entry: KeyEntry, index: number): string {
  return entry.sortId ?? `${index}::${entry.key}`;
}

export function useImageReorder<T extends KeyEntry>({
  value,
  onChange,
}: {
  value: T[];
  onChange: (next: T[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.findIndex((item, i) => imageEntrySortId(item, i) === active.id);
    const newIndex = value.findIndex((item, i) => imageEntrySortId(item, i) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(value, oldIndex, newIndex));
  };

  return { sensors, onDragEnd };
}

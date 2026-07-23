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
  key: string;
  /** Stable unique id required only when the same key can occur more than once. */
  sortId?: string;
};

export type ReorderableImageEntry = KeyEntry & { alt: string };

/** Stable sortable id; callers with duplicate keys must provide `sortId`. */
export function imageEntrySortId(entry: KeyEntry, _index: number): string {
  return entry.sortId ?? entry.key;
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

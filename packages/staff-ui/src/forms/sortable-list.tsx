"use client";

import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type SortableListProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  /** What a row is called in its buttons and announcements: "Vessel Study". */
  itemName: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Names the list for assistive technology: "Featured artists". */
  label: string;
  /** Leave out, with `onRemove`, for a read-only list: numbers and rows, no controls. */
  onMove?: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  /** A row with a problem gets the danger border; its message belongs in `renderItem`. */
  invalid?: (item: T, index: number) => boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * An ordered list of chosen records, one row each: its position, what it is, and controls to
 * reorder and remove it. Reorder by dragging the handle, by the arrow keys on the handle, or by
 * Move up and Move down; every move is announced and the handle keeps focus. On a phone the
 * controls sit under the row so its content keeps the width. Without `onMove`
 * and `onRemove` it is a read-only list.
 */
export function SortableList<T>({
  items,
  getKey,
  itemName,
  renderItem,
  label,
  onMove,
  onRemove,
  invalid,
  disabled = false,
  className,
}: SortableListProps<T>) {
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dropAt, setDropAt] = React.useState<number | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const handles = React.useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = React.useRef<string | null>(null);
  const instructionsId = React.useId();
  const total = items.length;
  const editable = onMove !== undefined || onRemove !== undefined;

  React.useEffect(() => {
    if (!pendingFocus.current) return;
    handles.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const move = (from: number, to: number, keepFocus = false) => {
    const item = items[from];
    if (disabled || !onMove || !item || to < 0 || to >= total || from === to) return;
    if (keepFocus) pendingFocus.current = getKey(item);
    onMove(from, to);
    setAnnouncement(`${itemName(item, from)} moved to position ${to + 1} of ${total}.`);
  };

  const remove = (index: number) => {
    const item = items[index];
    if (disabled || !onRemove || !item) return;
    onRemove(index);
    setAnnouncement(`${itemName(item, index)} removed.`);
  };

  const endDrag = () => {
    setDragFrom(null);
    setDropAt(null);
  };

  return (
    <div className={className}>
      {onMove ? (
        <p id={instructionsId} className="sr-only">
          Press the up or down arrow key on a handle to move the row.
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ol
        aria-label={label}
        className="flex list-none flex-col divide-y divide-staff-line-subtle overflow-hidden rounded-staff-lg border border-staff-line bg-staff-surface p-0"
      >
        {items.map((item, index) => {
          const key = getKey(item);
          const name = itemName(item, index);
          const reorderable = onMove !== undefined;
          const isInvalid = invalid?.(item, index) ?? false;
          return (
            <li
              key={key}
              draggable={reorderable && !disabled}
              onDragStart={(event) => {
                setDragFrom(index);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (dragFrom === null) return;
                event.preventDefault();
                setDropAt(index);
              }}
              onDragLeave={() => setDropAt((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragFrom !== null) move(dragFrom, index);
                endDrag();
              }}
              onDragEnd={endDrag}
              data-invalid={isInvalid || undefined}
              className={cn(
                "relative flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 sm:flex-nowrap sm:gap-3 sm:px-3",
                dragFrom === index && "bg-staff-sunken",
                dropAt === index &&
                  dragFrom !== null &&
                  dragFrom !== index &&
                  (dragFrom < index
                    ? "shadow-[inset_0_-2px_0_var(--color-staff-fg)]"
                    : "shadow-[inset_0_2px_0_var(--color-staff-fg)]"),
                isInvalid && "bg-staff-danger-bg",
              )}
            >
              {isInvalid ? (
                <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-staff-danger" />
              ) : null}
              {reorderable ? (
                <button
                  type="button"
                  disabled={disabled}
                  ref={(node) => {
                    if (node) handles.current.set(key, node);
                    else handles.current.delete(key);
                  }}
                  aria-label={`Move ${name}`}
                  aria-describedby={instructionsId}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      move(index, index - 1, true);
                    } else if (event.key === "ArrowDown") {
                      event.preventDefault();
                      move(index, index + 1, true);
                    }
                  }}
                  className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-staff-sm text-staff-muted hover:bg-staff-hover hover:text-staff-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-staff-focus active:cursor-grabbing disabled:cursor-not-allowed disabled:text-staff-disabled disabled:hover:bg-transparent"
                >
                  <GripVertical aria-hidden className="size-4" />
                </button>
              ) : null}
              <span
                aria-hidden
                className="w-5 shrink-0 text-center text-staff-sm text-staff-muted tabular-nums"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
              {editable ? (
                <span className="-mb-1 flex w-full shrink-0 items-center justify-end gap-0.5 sm:mb-0 sm:w-auto">
                  {onMove ? (
                    <>
                      <StaffButton
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${name} up`}
                        disabled={disabled || index === 0}
                        icon={<ArrowUp aria-hidden />}
                        onClick={() => move(index, index - 1)}
                      />
                      <StaffButton
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${name} down`}
                        disabled={disabled || index === total - 1}
                        icon={<ArrowDown aria-hidden />}
                        onClick={() => move(index, index + 1)}
                      />
                    </>
                  ) : null}
                  {onRemove ? (
                    <StaffButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${name}`}
                      disabled={disabled}
                      icon={<X aria-hidden />}
                      onClick={() => remove(index)}
                    />
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

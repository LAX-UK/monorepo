"use client";

import { ArrowLeft, ArrowRight, GripVertical, Star, Trash2 } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { type OverflowAction, OverflowMenu } from "../shell/overflow-menu.js";

export type MediaGridItem = {
  /** Stable while the item moves; the same file twice needs two ids. */
  id: string;
};

export type MediaGridProps<T extends MediaGridItem> = {
  items: readonly T[];
  /** The picture for a tile, filling a square; give it the item's alt text. */
  renderPreview: (item: T, index: number) => React.ReactNode;
  /** Fields under a tile, such as its alt text. */
  renderDetails?: (item: T, index: number) => React.ReactNode;
  /** What one item is called, in lower case: "photo", "cover image". */
  noun: string;
  /** The first item's role, shown on it: "Cover". Leave out when order carries no role. */
  primaryLabel?: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  /** The number shown on a tile when the grid shows a filtered part of a longer set. */
  numberOf?: (item: T, index: number) => number;
  disabled?: boolean;
  className?: string;
};

function moved(noun: string, to: number, total: number) {
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} moved to position ${to + 1} of ${total}.`;
}

/**
 * An ordered set of pictures, each a square tile with its position. Reorder by dragging a tile,
 * by the arrow keys on its handle, or from its `…` menu (make first, earlier, later); remove from
 * the same menu. Every move is announced. The first tile carries `primaryLabel` when set.
 */
export function MediaGrid<T extends MediaGridItem>({
  items,
  renderPreview,
  renderDetails,
  noun,
  primaryLabel,
  onMove,
  onRemove,
  disabled = false,
  numberOf,
  className,
}: MediaGridProps<T>) {
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dropAt, setDropAt] = React.useState<number | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const handles = React.useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = React.useRef<string | null>(null);
  const instructionsId = React.useId();
  const total = items.length;

  React.useEffect(() => {
    if (!pendingFocus.current) return;
    handles.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const move = (from: number, to: number, keepFocus = false) => {
    if (to < 0 || to >= total || from === to) return;
    const item = items[from];
    if (keepFocus && item) pendingFocus.current = item.id;
    onMove(from, to);
    setAnnouncement(moved(noun, to, total));
  };

  return (
    <div className={className}>
      <p id={instructionsId} className="sr-only">
        Press the left or right arrow key on a handle to move the {noun}.
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ol className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => {
          const number = numberOf ? numberOf(item, index) : index + 1;
          const position = `${noun} ${number}`;
          const actions: OverflowAction[] = [
            ...(primaryLabel && index > 0
              ? [
                  {
                    id: "first",
                    label: `Make ${primaryLabel.toLowerCase()}`,
                    icon: Star,
                    onSelect: () => move(index, 0),
                  },
                ]
              : []),
            {
              id: "earlier",
              label: "Move earlier",
              icon: ArrowLeft,
              disabled: index === 0,
              onSelect: () => move(index, index - 1),
            },
            {
              id: "later",
              label: "Move later",
              icon: ArrowRight,
              disabled: index === total - 1,
              onSelect: () => move(index, index + 1),
            },
            {
              id: "remove",
              label: `Remove ${noun}`,
              icon: Trash2,
              tone: "danger",
              onSelect: () => {
                onRemove(index);
                setAnnouncement(`${position} removed.`);
              },
            },
          ];
          return (
            <li
              key={item.id}
              draggable={!disabled}
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
                setDragFrom(null);
                setDropAt(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropAt(null);
              }}
              className={cn("flex min-w-0 flex-col gap-2", dragFrom === index && "opacity-50")}
            >
              <div
                className={cn(
                  "relative aspect-square overflow-hidden rounded-staff-md border bg-staff-sunken",
                  dropAt === index && dragFrom !== index
                    ? "border-staff-fg ring-2 ring-staff-fg/20"
                    : "border-staff-line",
                )}
              >
                <div className="size-full [&_img]:size-full [&_img]:object-cover">
                  {renderPreview(item, index)}
                </div>
                <div className="absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1">
                  <span className="flex items-center gap-1">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-staff-xs bg-staff-surface px-1.5 text-staff-xs font-medium tabular-nums text-staff-fg shadow-staff-xs">
                      {number}
                    </span>
                    {primaryLabel && index === 0 ? (
                      <span className="flex h-6 items-center rounded-staff-xs bg-staff-ink px-1.5 text-staff-xs font-medium text-staff-on-ink">
                        {primaryLabel}
                      </span>
                    ) : null}
                  </span>
                  {disabled ? null : (
                    <span className="flex items-center gap-1 rounded-staff-sm bg-staff-surface shadow-staff-xs">
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) handles.current.set(item.id, node);
                          else handles.current.delete(item.id);
                        }}
                        aria-label={`Move ${position}`}
                        aria-describedby={instructionsId}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                            event.preventDefault();
                            move(index, index - 1, true);
                          } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                            event.preventDefault();
                            move(index, index + 1, true);
                          }
                        }}
                        className="flex size-6 cursor-grab items-center justify-center rounded-staff-xs text-staff-muted hover:bg-staff-hover hover:text-staff-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-staff-focus active:cursor-grabbing"
                      >
                        <GripVertical aria-hidden className="size-3.5" />
                      </button>
                      <OverflowMenu
                        actions={actions}
                        label={`Actions for ${position}`}
                        size="icon-xs"
                      />
                    </span>
                  )}
                </div>
              </div>
              {renderDetails ? renderDetails(item, index) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

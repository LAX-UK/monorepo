"use client";

import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffDialog } from "../panels/staff-dialog.js";
import { StaffButton } from "../primitives/button.js";

export type ImageGalleryItem = {
  id: string;
  /** Null when the image cannot be shown; the tile says so instead of breaking. */
  src: string | null;
  /** Names the picture for screen readers, usually the work's title. */
  alt: string;
  /** The tile's first line, e.g. the title. */
  title: string;
  /** Short facts under the title, e.g. "2024 · Oil on linen · 60 × 80 cm". */
  caption?: string;
  /** A small label on the tile's corner, e.g. "Edition". */
  badge?: string;
};

function Picture({ item, className }: { item: ImageGalleryItem; className: string }) {
  if (!item.src) {
    return (
      <span className={cn("flex items-center justify-center text-staff-subtle", className)}>
        <ImageOff aria-hidden className="size-6" />
        <span className="sr-only">Image not available</span>
      </span>
    );
  }
  return (
    <img src={item.src} alt={item.alt} loading="lazy" className={cn("object-contain", className)} />
  );
}

/**
 * A set of pictures to look at, not edit: square tiles letterboxed on the sunken fill with a title
 * and caption under each. A tile opens a large viewer with the caption, "3 of 8", previous and
 * next buttons, and the arrow keys; Escape closes it and focus returns to the tile.
 */
export function ImageGallery({
  items,
  label,
  className,
}: {
  items: readonly ImageGalleryItem[];
  /** Names the set, e.g. "Works sent with the application". */
  label: string;
  className?: string;
}) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const total = items.length;
  const current = openIndex === null ? null : (items[openIndex] ?? null);

  const step = React.useCallback(
    (by: number) => {
      setOpenIndex((index) => (index === null ? null : (index + by + total) % total));
    },
    [total],
  );

  // While the viewer is open, the arrow keys move through the set from anywhere in it.
  const viewing = openIndex !== null && total > 1;
  React.useEffect(() => {
    if (!viewing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [viewing, step]);

  return (
    <>
      <ul
        aria-label={label}
        className={cn("grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3", className)}
      >
        {items.map((item, index) => (
          <li key={item.id} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="staff-focus group flex w-full flex-col gap-2 rounded-staff-md text-left"
              aria-label={`View ${item.title}, ${index + 1} of ${total}`}
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-staff-md border border-staff-line bg-staff-sunken transition-[border-color] duration-150 group-hover:border-staff-line-hover">
                <Picture item={item} className="absolute inset-0 size-full p-2" />
                {item.badge ? (
                  <span className="absolute top-2 left-2 rounded-staff-xs border border-staff-line bg-staff-raised px-1.5 py-0.5 text-staff-xs font-medium text-staff-fg">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-2 text-staff-sm font-medium text-staff-fg">
                  {item.title}
                </span>
                {item.caption ? (
                  <span className="text-staff-xs text-staff-muted">{item.caption}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <StaffDialog
        open={current !== null}
        onOpenChange={(open) => {
          if (!open) setOpenIndex(null);
        }}
        size="lg"
        title={current?.title ?? label}
        description={current?.caption}
        footer={
          openIndex !== null ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              {total > 1 ? (
                <div className="flex items-center gap-2">
                  <StaffButton
                    variant="secondary"
                    icon={<ChevronLeft aria-hidden />}
                    onClick={() => step(-1)}
                  >
                    Previous
                  </StaffButton>
                  <StaffButton variant="secondary" onClick={() => step(1)}>
                    Next
                    <ChevronRight aria-hidden />
                  </StaffButton>
                  <span className="ml-2 text-staff-sm text-staff-muted" aria-live="polite">
                    {openIndex + 1} of {total}
                  </span>
                </div>
              ) : (
                <span />
              )}
              <StaffButton variant="secondary" onClick={() => setOpenIndex(null)}>
                Close
              </StaffButton>
            </div>
          ) : null
        }
      >
        {current ? (
          <div className="flex items-center justify-center rounded-staff-md bg-staff-sunken">
            <Picture item={current} className="max-h-[65dvh] w-full" />
          </div>
        ) : null}
      </StaffDialog>
    </>
  );
}

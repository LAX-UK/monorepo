"use client";

import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@auction/ui";
import { useEffect, useRef } from "react";
import {
  EmptyStage,
  LotMediaStrip,
  type LotMediaViewProps,
  NO_IMAGE_LABEL,
  STAGE_BOX,
  STUDIO_GROUND,
  ViewerButton,
} from "./lot-media-parts";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Showcase: a wide gallery of 3:2 pictures that fill the frame, edge to edge on a phone. Swipe
 * (or use the arrow keys on the focused gallery) to move through them; the strip below jumps to
 * one, and the counter says where you are.
 */
export function SwipeView({
  title,
  images,
  index,
  onIndexChange,
  onOpenViewer,
  stripLabel,
}: LotMediaViewProps) {
  const track = useRef<HTMLUListElement>(null);
  const settledIndex = useRef(index);

  // A pick from the strip scrolls the gallery to that picture.
  useEffect(() => {
    const el = track.current;
    if (!el || settledIndex.current === index) return;
    settledIndex.current = index;
    el.scrollTo({
      left: index * el.clientWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [index]);

  if (images.length === 0) return <EmptyStage title={title} />;

  return (
    <>
      <div className={cn(STAGE_BOX, STUDIO_GROUND, "aspect-[3/2] overflow-hidden")}>
        <ul
          ref={track}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable gallery must be focusable (WCAG 2.1.1)
          tabIndex={0}
          aria-label={`${title}, images`}
          aria-roledescription="carousel"
          onScroll={(event) => {
            const el = event.currentTarget;
            const next = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
            if (next !== settledIndex.current && next >= 0 && next < images.length) {
              settledIndex.current = next;
              onIndexChange(next);
            }
          }}
          className="lax-focus m-0 flex size-full list-none snap-x snap-mandatory overflow-x-auto overscroll-x-contain p-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, i) => (
            <li
              key={image.src}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${images.length}`}
              className="relative size-full shrink-0 snap-center"
            >
              <MediaImage
                src={image.src}
                alt={image.alt ?? title}
                label={NO_IMAGE_LABEL}
                sizes="(min-width: 1024px) 56vw, 100vw"
                priority={i === 0}
                imgClassName="object-cover"
              />
            </li>
          ))}
        </ul>
        {images.length > 1 ? (
          <p
            className="pointer-events-none absolute bottom-4 left-4 m-0 rounded-full bg-black/60 px-3 py-1 text-lax-13 text-white"
            aria-live="polite"
          >
            {index + 1} / {images.length}
          </p>
        ) : null}
        <ViewerButton onClick={() => onOpenViewer()} />
      </div>
      <LotMediaStrip
        images={images}
        index={index}
        onSelect={onIndexChange}
        label={stripLabel}
        fit="cover"
      />
    </>
  );
}

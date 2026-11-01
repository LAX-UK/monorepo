"use client";

import { cn } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";
import { CoverSlideView } from "./cover-slide.js";
import {
  COVER_MAX_SLIDES,
  activeCoverMedia,
  activeCoverMediaIndex,
  stepSlide,
} from "./cover-sources.js";
import type { MarketingCoverProps } from "./cover-types.js";

/**
 * The cover: the home page's first screen for LAX Bid and LAX Shop. One component with three
 * modes, chosen from what the slide can show: a photograph under a measured scrim, a plate (the
 * lead work, whole, on a field of its own colour), or type only on the page tone.
 *
 * Pictures are tried in order. One that fails to load is skipped without a message, and when
 * none is left the cover is type only. Several pinned sales get previous and next; nothing
 * rotates by itself.
 */
export function MarketingCover({
  slides,
  label,
  Link,
  priority = false,
  className,
}: MarketingCoverProps) {
  const shown = useMemo(() => slides.slice(0, COVER_MAX_SLIDES), [slides]);
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  const index = Math.min(position, Math.max(shown.length - 1, 0));
  const slide = shown[index];

  const failedForSlide = useMemo(() => {
    const set = new Set<number>();
    if (!slide) return set;
    slide.media.forEach((_, i) => {
      if (failed.has(`${slide.id}:${i}`)) set.add(i);
    });
    return set;
  }, [failed, slide]);

  const mediaIndex = slide ? activeCoverMediaIndex(slide.media, failedForSlide) : -1;
  const media = slide ? activeCoverMedia(slide.media, failedForSlide) : null;

  const onMediaFail = useCallback(() => {
    if (!slide || mediaIndex < 0) return;
    const key = `${slide.id}:${mediaIndex}`;
    setFailed((previous) => new Set(previous).add(key));
  }, [slide, mediaIndex]);

  const onStep = useCallback(
    (direction: 1 | -1) => setPosition((current) => stepSlide(current, shown.length, direction)),
    [shown.length],
  );

  if (!slide) return null;
  const several = shown.length > 1;

  return (
    <section
      aria-label={label}
      {...(several ? { "aria-roledescription": "carousel" } : {})}
      data-lax-ui=""
      className={cn("w-full bg-surface text-on-surface", className)}
    >
      <CoverSlideView
        key={`${slide.id}:${mediaIndex}`}
        slide={slide}
        media={media}
        Link={Link}
        priority={priority && index === 0}
        onMediaFail={onMediaFail}
        pager={several ? { index, count: shown.length, onStep } : null}
        group={several ? { label: `${index + 1} of ${shown.length}` } : null}
      />
    </section>
  );
}

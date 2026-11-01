"use client";

import { cn } from "@auction/ui";
import { type CSSProperties, useCallback, useState } from "react";
import { COVER_WIDE_FROM_PX, planCoverBoxes } from "./cover-crop.js";
import type { CoverPhotoMedia, CoverPlateMedia } from "./cover-types.js";

/** The fade from the blurred preview to the sharp picture. */
const FADE_CLASS = "transition-opacity duration-[240ms] ease-out motion-reduce:transition-none";

/**
 * Tracks one image's load. A picture that finished before React attached (cached, or loaded
 * during hydration) is caught by `complete`, so it never sticks at opacity 0.
 */
function useImageLoad(onError: () => void) {
  const [loaded, setLoaded] = useState(false);
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth > 0) setLoaded(true);
      if (img?.complete && img.naturalWidth === 0 && img.currentSrc) onError();
    },
    [onError],
  );
  return { loaded, ref, onLoad: () => setLoaded(true) };
}

/** The preview a picture fades in from: its dominant colour and a 24px blurred copy. */
function BlurUp({ colour, blurDataURL }: { colour: string; blurDataURL?: string | undefined }) {
  const style: CSSProperties = {
    backgroundColor: colour,
    ...(blurDataURL ? { backgroundImage: `url("${blurDataURL}")` } : {}),
  };
  return (
    <div
      aria-hidden
      data-cover-blur=""
      className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
      style={style}
    />
  );
}

/** The CSS variables carrying each box's frame, read by static classes below. */
function frameVars(media: CoverPhotoMedia): CSSProperties {
  const plan = planCoverBoxes(media);
  const vars: Record<string, string> = {};
  for (const box of ["phone", "desktop", "wide"] as const) {
    const { frame } = plan[box];
    vars[`--cover-${box}-w`] = `${frame.width}%`;
    vars[`--cover-${box}-h`] = `${frame.height}%`;
    vars[`--cover-${box}-l`] = `${frame.left}%`;
    vars[`--cover-${box}-t`] = `${frame.top}%`;
  }
  return vars as CSSProperties;
}

const FRAME_CLASS = [
  "absolute max-w-none",
  "w-[var(--cover-phone-w)] h-[var(--cover-phone-h)] left-[var(--cover-phone-l)] top-[var(--cover-phone-t)]",
  "md:w-[var(--cover-desktop-w)] md:h-[var(--cover-desktop-h)] md:left-[var(--cover-desktop-l)] md:top-[var(--cover-desktop-t)]",
  "min-[1600px]:w-[var(--cover-wide-w)] min-[1600px]:h-[var(--cover-wide-h)] min-[1600px]:left-[var(--cover-wide-l)] min-[1600px]:top-[var(--cover-wide-t)]",
].join(" ");

/**
 * A cover photograph in a fixed box: the box has its size before the picture arrives, so
 * nothing moves when it does. The dominant colour and a blurred preview show first.
 */
export function CoverPhoto({
  media,
  priority,
  onFail,
}: {
  media: CoverPhotoMedia;
  priority: boolean;
  onFail: () => void;
}) {
  const plan = planCoverBoxes(media);
  const { loaded, ref, onLoad } = useImageLoad(onFail);
  const preview = plan.desktop.slot.blurDataURL ?? media.slots.default.blurDataURL;
  return (
    <div className="absolute inset-0 overflow-hidden" style={frameVars(media)}>
      <BlurUp colour={media.colour} blurDataURL={preview} />
      <picture>
        <source media={`(min-width: ${COVER_WIDE_FROM_PX}px)`} srcSet={plan.wide.slot.src} />
        <source media="(min-width: 768px)" srcSet={plan.desktop.slot.src} />
        <img
          ref={ref}
          src={plan.phone.slot.src}
          alt={media.alt}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          onLoad={onLoad}
          onError={onFail}
          className={cn(FRAME_CLASS, FADE_CLASS, loaded ? "opacity-100" : "opacity-0")}
        />
      </picture>
    </div>
  );
}

/**
 * The lead work, whole, on a flat field of its own deepest colour. The work sits on the third
 * away from the type, as large as the box allows with room around it, like a catalogue plate.
 */
export function CoverPlate({
  media,
  priority,
  onFail,
}: {
  media: CoverPlateMedia;
  priority: boolean;
  onFail: () => void;
}) {
  const { loaded, ref, onLoad } = useImageLoad(onFail);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: media.field }}>
      <div
        className={cn(
          "absolute inset-y-8 inset-x-16 flex items-center justify-center",
          media.side === "left" ? "md:left-1/2" : "md:right-1/2",
          "md:inset-x-auto md:w-[min(46%,640px)] md:inset-y-14",
        )}
      >
        <img
          ref={ref}
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          onLoad={onLoad}
          onError={onFail}
          className={cn(
            "max-h-full max-w-full object-contain shadow-[0_18px_48px_rgba(0,0,0,0.38)]",
            FADE_CLASS,
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}

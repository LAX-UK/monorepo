"use client";

import { cn } from "@auction/ui";
import { type CSSProperties, type ReactNode, useCallback, useState } from "react";
import { COVER_WIDE_FROM_PX, planCoverBoxes } from "./cover-crop.js";
import type { CoverPhotoMedia, CoverPlateMedia } from "./cover-types.js";

/** The fade from the blurred preview to the sharp picture. */
const FADE_CLASS = "transition-opacity duration-[240ms] ease-out motion-reduce:transition-none";

type LoadPhase = "ssr" | "loading" | "loaded";

/**
 * Tracks one image's load for the fade. The picture is drawn from the server's HTML as it is, so
 * the largest element is never held back. Only a picture still downloading when the page wakes
 * up is hidden and faded in over its preview; one that already finished is left alone, and one
 * that finished broken is reported so the next source takes over.
 */
function useImageLoad(onError: () => void) {
  const [phase, setPhase] = useState<LoadPhase>("ssr");
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      if (!img.complete) setPhase((current) => (current === "ssr" ? "loading" : current));
      else if (img.naturalWidth === 0 && img.currentSrc) onError();
    },
    [onError],
  );
  const hidden = phase === "loading";
  return { hidden, ref, onLoad: () => setPhase("loaded") };
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
  const { hidden, ref, onLoad } = useImageLoad(onFail);
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
          className={cn(FRAME_CLASS, FADE_CLASS, hidden ? "opacity-0" : "opacity-100")}
        />
      </picture>
    </div>
  );
}

/**
 * The lead work, whole, on a flat field of its own deepest colour. The work floats on the third
 * away from the type with room above and below, like a catalogue plate; on a desktop its credit
 * hangs centred under it.
 */
export function CoverPlate({
  media,
  credit,
  priority,
  onFail,
}: {
  media: CoverPlateMedia;
  /** The credit shown under the work from the desktop width up. */
  credit?: ReactNode;
  priority: boolean;
  onFail: () => void;
}) {
  const { hidden, ref, onLoad } = useImageLoad(onFail);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: media.field }}>
      <div
        className={cn(
          "absolute inset-x-8 inset-y-8 flex items-center justify-center",
          "md:inset-x-auto md:inset-y-0 md:w-[41.67%] md:pb-10",
          media.side === "left" ? "md:left-1/2" : "md:right-1/2",
        )}
      >
        <div className="relative">
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
              "block h-auto max-h-[270px] w-auto max-w-[290px] object-contain md:max-h-[470px] md:max-w-[600px]",
              "shadow-[0_2px_4px_rgba(0,0,0,0.28),0_28px_56px_-18px_rgba(0,0,0,0.6)]",
              FADE_CLASS,
              hidden ? "opacity-0" : "opacity-100",
            )}
          />
          {credit ? (
            <p className="absolute left-1/2 top-full mt-[18px] hidden -translate-x-1/2 whitespace-nowrap font-body text-xs leading-4 text-[color:var(--cover-credit)] md:block">
              {credit}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { cn } from "@auction/ui";
import { ButtonLink, TextLink } from "@auction/ui/lax";
import { Check, Clock } from "lucide-react";
import type { CSSProperties, ElementType } from "react";
import { coverSettles } from "./cover-motion.js";
import { ON_IMAGE_BADGE, ON_IMAGE_BUTTON, PHONE_IMAGE_BADGE } from "./cover-on-image.js";
import { CoverPager } from "./cover-pager.js";
import { CoverPhoto, CoverPlate } from "./cover-picture.js";
import {
  CREDIT_BAND_HEIGHT_PX,
  coverTextVars,
  creditBandBackground,
  scrimBackground,
  scrimsForPhoto,
} from "./cover-scrim.js";
import type { PhotoScrims } from "./cover-scrim.js";
import { coverTitleClass } from "./cover-type-scale.js";
import type { CoverMedia, CoverSide, CoverSlide, CoverTone } from "./cover-types.js";

const BADGE_BASE =
  "inline-flex h-5 shrink-0 items-center rounded-[4px] px-2 font-body text-xs font-medium leading-4";

/** What the cover is drawn on: a photograph, a plate, or nothing but the page. */
type Ground =
  | {
      mode: "photo";
      media: Extract<CoverMedia, { kind: "photo" }>;
      tone: CoverTone;
      scrims: PhotoScrims;
    }
  | { mode: "plate"; media: Extract<CoverMedia, { kind: "plate" }>; tone: CoverTone }
  | { mode: "type" };

function groundFor(media: CoverMedia | null): Ground {
  if (!media) return { mode: "type" };
  if (media.kind === "plate") return { mode: "plate", media, tone: media.tone };
  const scrims = scrimsForPhoto(media);
  return scrims ? { mode: "photo", media, tone: scrims.tone, scrims } : { mode: "type" };
}

/** The scrim and credit band for each desktop size; the wide pair shows from 1600px. */
function Scrims({ scrims, side }: { scrims: PhotoScrims; side: CoverSide }) {
  const sizes = [
    {
      setting: scrims.desktop,
      className: scrims.wide ? "md:block min-[1600px]:hidden" : "md:block",
    },
    ...(scrims.wide ? [{ setting: scrims.wide, className: "min-[1600px]:block" }] : []),
  ];
  return (
    <>
      {sizes.map(({ setting, className }) => (
        <div
          key={className}
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 hidden", className)}
        >
          <div
            data-cover-scrim=""
            className="absolute inset-0"
            style={{
              backgroundImage: scrimBackground({
                side,
                tone: setting.tone,
                strength: setting.strength,
              }),
            }}
          />
          <div
            data-cover-credit-band=""
            className="absolute inset-x-0 bottom-0"
            style={{
              height: CREDIT_BAND_HEIGHT_PX,
              backgroundImage: creditBandBackground({
                tone: setting.tone,
                creditBand: setting.creditBand,
              }),
            }}
          />
        </div>
      ))}
    </>
  );
}

function Badge({ label, ground }: { label: string; ground: Ground }) {
  const surface =
    ground.mode === "type" ? "md:bg-on-surface md:text-surface" : ON_IMAGE_BADGE[ground.tone];
  return (
    <>
      {/* On a phone the badge sits on the picture; this copy is for screen readers there. */}
      <span className={cn(BADGE_BASE, "bg-on-surface text-surface max-md:sr-only", surface)}>
        {label}
      </span>
    </>
  );
}

export type CoverSlideViewProps = {
  slide: CoverSlide;
  media: CoverMedia | null;
  Link: ElementType | undefined;
  priority: boolean;
  onMediaFail: () => void;
  pager: { index: number; count: number; onStep: (direction: 1 | -1) => void } | null;
  group: { label: string } | null;
};

/** One slide of the cover: the picture, the scrim and the type, in one DOM for every width. */
export function CoverSlideView({
  slide,
  media,
  Link,
  priority,
  onMediaFail,
  pager,
  group,
}: CoverSlideViewProps) {
  const ground = groundFor(media);
  const side: CoverSide = ground.mode === "type" ? "left" : ground.media.side;
  const onImage = ground.mode === "type" ? null : ground.tone;
  const textLeft = side === "left";
  const vars: CSSProperties | undefined = onImage
    ? (coverTextVars(onImage) as CSSProperties)
    : undefined;
  const settles = coverSettles(media);

  return (
    <div
      data-cover-mode={ground.mode}
      data-cover-side={side}
      className={cn(
        "relative isolate md:h-[640px] min-[1600px]:h-[720px] md:overflow-hidden",
        ground.mode === "type" && "md:bg-surface-container-low",
      )}
      style={vars}
      {...(group
        ? { role: "group", "aria-roledescription": "slide", "aria-label": group.label }
        : {})}
    >
      {ground.mode === "type" ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_70%_120%_at_88%_100%,var(--color-surface-container,transparent),transparent_70%)] md:block",
            settles && "marketing-cover-settle",
          )}
        />
      ) : (
        <div
          className="relative h-[340px] overflow-hidden bg-surface-container md:absolute md:inset-0 md:h-auto"
          data-cover-media=""
        >
          <div className={cn("absolute inset-0", settles && "marketing-cover-settle")}>
            {ground.mode === "photo" ? (
              <CoverPhoto media={ground.media} priority={priority} onFail={onMediaFail} />
            ) : (
              <CoverPlate media={ground.media} priority={priority} onFail={onMediaFail} />
            )}
          </div>
          {ground.mode === "photo" ? <Scrims scrims={ground.scrims} side={side} /> : null}
          {slide.badge ? (
            <span
              aria-hidden
              className={cn(BADGE_BASE, PHONE_IMAGE_BADGE, "absolute left-4 top-4 md:hidden")}
            >
              {slide.badge}
            </span>
          ) : null}
        </div>
      )}

      {slide.credit ? (
        <p
          className={cn(
            "relative min-w-0 truncate px-4 pt-3 font-body text-xs leading-4 text-on-surface-variant",
            "md:absolute md:bottom-6 md:max-w-[520px] md:p-0 md:text-[color:var(--cover-credit)]",
            onImage ? (textLeft ? "md:right-10" : "md:left-10") : "md:hidden",
          )}
        >
          {slide.credit.href ? (
            <TextLink
              href={slide.credit.href}
              {...(Link ? { Link } : {})}
              className="inline max-w-full truncate text-xs font-normal leading-4 text-inherit"
            >
              {slide.credit.text}
            </TextLink>
          ) : (
            slide.credit.text
          )}
        </p>
      ) : null}

      <div
        className={cn(
          "relative flex flex-col px-4 pb-8 pt-5",
          "md:absolute md:bottom-14 md:w-[640px] md:max-w-[calc(100%-5rem)] md:p-0",
          textLeft ? "md:left-10" : "md:right-10",
        )}
      >
        {slide.badge || slide.time ? (
          <p className="mb-4 flex items-center gap-3 font-body text-[13px] leading-5 text-on-surface-variant md:text-sm md:text-[color:var(--cover-eyebrow)]">
            {slide.badge ? <Badge label={slide.badge} ground={ground} /> : null}
            {slide.time ? <span className="font-medium">{slide.time}</span> : null}
          </p>
        ) : null}
        <h1
          className={cn(
            "font-headline font-medium text-balance text-on-surface",
            onImage && "md:text-[color:var(--cover-title)]",
            coverTitleClass(slide.title),
          )}
        >
          {slide.title}
        </h1>
        {slide.fact ? (
          <p className="mt-3 font-body text-[15px] leading-[22px] text-on-surface-variant md:max-w-[560px] md:text-[17px] md:leading-[26px] md:text-[color:var(--cover-sub)]">
            {slide.fact}
          </p>
        ) : null}
        {slide.status ? (
          <p className="mt-3 flex items-center gap-2 font-body text-sm leading-5 text-on-surface-variant md:text-[color:var(--cover-sub)]">
            {slide.status.icon === "check" ? (
              <Check aria-hidden className="size-4 shrink-0" />
            ) : (
              <Clock aria-hidden className="size-4 shrink-0" />
            )}
            {slide.status.text}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <ButtonLink
            href={slide.primary.href}
            {...(Link ? { Link } : {})}
            variant="primary"
            size="md"
            className={cn(
              "max-md:h-lax-control-lg max-md:w-full",
              onImage && ON_IMAGE_BUTTON[onImage],
            )}
          >
            {slide.primary.label}
          </ButtonLink>
          {slide.link ? (
            <TextLink
              href={slide.link.href}
              {...(Link ? { Link } : {})}
              className={cn(
                "max-md:min-h-11 max-md:justify-center",
                onImage && "md:text-[color:var(--cover-link)]",
              )}
            >
              {slide.link.label}
            </TextLink>
          ) : null}
        </div>
        {pager ? (
          <CoverPager
            index={pager.index}
            count={pager.count}
            tone={onImage}
            onStep={pager.onStep}
            className={cn(
              "mt-4 md:absolute md:bottom-[-40px] md:mt-0",
              textLeft ? "md:left-0" : "md:right-0",
            )}
          />
        ) : null}
      </div>
    </div>
  );
}

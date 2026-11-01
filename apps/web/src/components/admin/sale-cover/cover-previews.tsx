"use client";

import type { SlotDraft } from "@/lib/admin/sale-cover/cover-draft";
import {
  type CropPreview,
  type MeasureState,
  PREVIEW_BOXES,
  PREVIEW_LABEL,
  type ToneReading,
  cropPreview,
  measureState,
  readTone,
  slotServingBox,
  toneBadge,
} from "@/lib/admin/sale-cover/cover-previews";
import type { CoverView } from "@/lib/admin/sale-cover/cover-view";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { BAND_STOPS, COVER_BOXES, RADIAL_RADIUS, RADIAL_STOPS } from "@auction/domain";
import { cn } from "@auction/staff-ui";
import type { CoverTextTone, SaleCoverSlotName } from "@auction/types";

type Props = {
  slots: Partial<Record<SaleCoverSlotName, SlotDraft>>;
  view: CoverView;
};

const SCRIM_RGB: Record<CoverTextTone, string> = { light: "10 11 11", dark: "246 244 238" };

/** The scrim as the page paints it: a radial from the text corner and a band under the credit. */
function scrimBackground(
  preview: CropPreview,
  tone: CoverTextTone,
  strength: number,
  band: number,
) {
  const rgb = SCRIM_RGB[tone];
  const origin = preview.side === "right" ? "100%" : "0%";
  const radial = RADIAL_STOPS.map(
    ([at, share]) => `rgb(${rgb} / ${(strength * share).toFixed(3)}) ${at}%`,
  ).join(", ");
  const bandStops = BAND_STOPS.map(
    ([px, share]) =>
      `rgb(${rgb} / ${(band * share).toFixed(3)}) ${((px / preview.height) * 100).toFixed(1)}%`,
  ).join(", ");
  return [
    `linear-gradient(to top, ${bandStops})`,
    `radial-gradient(${RADIAL_RADIUS.x * 100}% ${RADIAL_RADIUS.y * 100}% at ${origin} 100%, ${radial})`,
  ].join(", ");
}

function CropFrame({
  preview,
  src,
  reading,
}: {
  preview: CropPreview;
  src: string | null;
  reading: ToneReading;
}) {
  const { crop } = preview;
  return (
    <div
      className="relative overflow-hidden rounded-staff-sm bg-staff-sunken ring-1 ring-staff-line ring-inset"
      style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
      data-testid={`preview-${preview.box}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            width: `${100 / crop.width}%`,
            height: `${100 / crop.height}%`,
            left: `${(-crop.x / crop.width) * 100}%`,
            top: `${(-crop.y / crop.height) * 100}%`,
          }}
        />
      ) : null}
      {reading.kind === "measured" ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: scrimBackground(
              preview,
              reading.tone,
              reading.scrim.strength,
              reading.scrim.creditBand,
            ),
          }}
        />
      ) : null}
      {preview.zones.map((zone) => (
        <span
          key={zone.line}
          aria-hidden
          className="absolute rounded-[2px] border border-dashed border-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.45)]"
          style={{
            left: `${(zone.x / preview.width) * 100}%`,
            top: `${(zone.y / preview.height) * 100}%`,
            width: `${(zone.width / preview.width) * 100}%`,
            height: `${(zone.height / preview.height) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

function badgeClass(reading: ToneReading): string {
  if (reading.kind === "measured") return "bg-staff-success-bg text-staff-success-fg";
  if (reading.kind === "plate") return "bg-staff-warning-bg text-staff-warning-fg";
  return "bg-staff-neutral-bg text-staff-neutral-fg";
}

/**
 * The three crops the home page will make, drawn live from the picture, focal point, zoom and text
 * side being edited. On the two wide sizes the text zones are outlined and, once the picture has
 * been measured, the scrim and the lowest contrast reached are shown. A phone has no type on the
 * picture, so it shows the crop alone.
 */
export function CoverPreviews({ slots, view }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {PREVIEW_BOXES.map((box) => {
        const name = slotServingBox(box, slots);
        const draft = slots[name];
        const preview = draft ? cropPreview(box, name, draft) : null;
        const measure: MeasureState =
          box === "phone" ? { kind: "none" } : measureState(name, draft, view.slots[name]);
        const reading = readTone(box, measure, draft?.toneOverride);
        const { width, height } = COVER_BOXES[box];
        return (
          <figure
            key={box}
            className={cn("m-0 flex flex-col gap-1.5", box === "phone" && "max-w-[60%]")}
          >
            {preview && draft ? (
              <CropFrame
                preview={preview}
                src={resolveMediaSrc(draft.pictureKey)}
                reading={reading}
              />
            ) : (
              <div
                className="grid place-items-center rounded-staff-sm bg-staff-sunken text-staff-sm text-staff-muted ring-1 ring-staff-line ring-inset"
                style={{ aspectRatio: `${width} / ${height}` }}
              >
                No picture yet
              </div>
            )}
            <figcaption className="flex flex-wrap items-center justify-between gap-2 text-staff-sm">
              <span>
                <span className="font-medium text-staff-fg">{PREVIEW_LABEL[box]}</span>
                <span className="text-staff-muted">
                  {" "}
                  · {width} × {height}
                  {draft && name === "default" && box !== "desktop" ? " · uses the default" : ""}
                </span>
              </span>
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-staff-xs px-2 text-staff-xs font-medium",
                  badgeClass(reading),
                )}
              >
                {toneBadge(reading)}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

import { COVER_SLOT_FLOORS } from "@auction/domain/cover";
import type { SaleCoverSlotAsset, SaleCoverSlotAssets } from "@auction/types";
import type { CoverPhotoMedia, CoverPhotoSlot } from "./cover-types.js";

function toPhotoSlot(asset: SaleCoverSlotAsset): CoverPhotoSlot {
  return {
    src: asset.src,
    width: asset.width,
    height: asset.height,
    ...(asset.blurDataURL ? { blurDataURL: asset.blurDataURL } : {}),
    focal: asset.focal,
    ...(asset.keep ? { keep: asset.keep } : {}),
    zoom: asset.zoom,
  };
}

/**
 * The cover photograph, when there is one that can carry text: the default slot is measured,
 * at least the floor wide, and its tone reaches contrast. Anything else is not used, and the
 * next source (the plate) takes over.
 */
export function photoFromCover(cover: SaleCoverSlotAssets | undefined): CoverPhotoMedia | null {
  const base = cover?.default;
  if (!base || base.analysisStatus !== "ready" || !base.colours) return null;
  if (base.width < COVER_SLOT_FLOORS.default.minWidth) return null;
  if (!base.scrim.desktop) return null;
  const wide = cover.wide;
  const phone = cover.phone;
  return {
    kind: "photo",
    alt: base.alt,
    side: base.side,
    slots: {
      default: toPhotoSlot(base),
      ...(wide ? { wide: toPhotoSlot(wide) } : {}),
      ...(phone ? { phone: toPhotoSlot(phone) } : {}),
    },
    scrim: {
      desktop: base.scrim.desktop,
      wide: wide?.scrim.wide ?? base.scrim.wide ?? null,
    },
    colour: base.colours.dominant,
  };
}

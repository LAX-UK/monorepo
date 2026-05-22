import type { ObjectFitMode, OverlaySlotDef } from "@/lib/media/overlay-tone-types";

export type AdaptiveMediaConfig = {
  src: string | null | undefined;
  objectFit: ObjectFitMode;
  slots: OverlaySlotDef[];
  alt: string;
  sizes?: string;
  label?: string;
};

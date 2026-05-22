import type { FixedSlotDef, NormalizedRect, OverlaySlotDef } from "./overlay-tone-types";

export type { FixedSlotDef, OverlaySlotDef };

export const SLOT_RECTS: Record<Exclude<FixedSlotDef["name"], never>, NormalizedRect> = {
  topLeft: { x: 0, y: 0, w: 0.42, h: 0.14 },
  topRight: { x: 0.58, y: 0, w: 0.42, h: 0.14 },
  bottomLeft: { x: 0, y: 0.78, w: 0.58, h: 0.22 },
  bottomRight: { x: 0.58, y: 0.78, w: 0.42, h: 0.22 },
};

export const LOT_CARD_GRID_SLOTS: FixedSlotDef[] = [
  { name: "topLeft", type: "pill", rect: SLOT_RECTS.topLeft },
  { name: "topRight", type: "pill", rect: SLOT_RECTS.topRight },
];

export const LOT_CARD_TIMER_SLOTS: FixedSlotDef[] = [
  ...LOT_CARD_GRID_SLOTS,
  { name: "bottomLeft", type: "pill", rect: SLOT_RECTS.bottomLeft },
];

export const GALLERY_HERO_SLOTS: FixedSlotDef[] = [
  { name: "topRight", type: "pill", rect: SLOT_RECTS.topRight },
  { name: "bottomRight", type: "pill", rect: SLOT_RECTS.bottomRight },
];

export const HERO_CONTENT_BLOCK_SLOT = { name: "contentBlock" as const, type: "heroBody" as const };

export const HERO_IMMERSIVE_SLOTS: OverlaySlotDef[] = [HERO_CONTENT_BLOCK_SLOT];

export const EDITORIAL_CALM_SLOTS: FixedSlotDef[] = [
  { name: "topRight", type: "pill", rect: SLOT_RECTS.topRight },
];

export const EDITORIAL_BOLD_SLOTS: OverlaySlotDef[] = [
  { name: "topRight", type: "pill", rect: SLOT_RECTS.topRight },
  { name: "contentBlock", type: "heroBody" },
];

/** Normalized rect in 0–1 space (x, y = top-left). */
export type NormalizedRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ObjectFitMode = "contain" | "cover";

export type SlotName = "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "contentBlock";

export type SlotType = "pill" | "heroBody" | "heroDisplay";

export type OverlayTone = "light" | "dark";

/** Downsampled luminance samples from a clipped image region. */
export type RegionPixels = {
  luminances: Float32Array;
  width: number;
  height: number;
};

export type OverlayToneResult =
  | { kind: "frosted"; tone: OverlayTone; contrast: number }
  | { kind: "opaque"; tone: OverlayTone; contrast: number };

export type ProjectSlotResult =
  | { kind: "sample"; rect: NormalizedRect }
  | { kind: "opaque"; tone: OverlayTone };

export type FixedSlotDef = {
  name: Exclude<SlotName, "contentBlock">;
  type: SlotType;
  rect: NormalizedRect;
};

export type ContentBlockSlotDef = { name: "contentBlock"; type: SlotType };

export type OverlaySlotDef = FixedSlotDef | ContentBlockSlotDef;

export type ContainerBounds = {
  width: number;
  height: number;
};

export type ImageIntrinsic = {
  naturalWidth: number;
  naturalHeight: number;
};

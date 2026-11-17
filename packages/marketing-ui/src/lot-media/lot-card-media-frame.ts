import type { DepartmentDisplayStyle } from "@auction/domain";

/**
 * How a lot's picture sits in its card. Every lot card on Bid (sale page, search, results,
 * watching, home) reads this one table, so a lot looks the same wherever it appears.
 *
 * One frame for every picture (owner decision, 16 Nov 2026): whatever the department, the
 * picture is shown whole, centred on the same mat, with the same padding and the soft shadow, in
 * the same 4:5 box, so titles, estimates and status line up across a row of mixed lots and no
 * picture is cropped. The table stays keyed by display style so a department can be given its
 * own frame again without touching any card.
 */
export type LotCardMediaFrame = {
  /** The frame's ratio: the same for every style. */
  aspect: string;
  /** Space around the picture; none where it spans the box. */
  inset: string;
  fit: "contain" | "cover";
  /** What the picture sits on. */
  ground: "mat" | "studio";
  /** The soft shadow under a picture that is shown whole on the mat. */
  shadow: boolean;
};

const BOX = "aspect-[4/5]";

const ONE_FRAME: LotCardMediaFrame = {
  aspect: BOX,
  inset: "p-[7%]",
  fit: "contain",
  ground: "mat",
  shadow: true,
};

export const LOT_CARD_MEDIA_FRAMES: Readonly<Record<DepartmentDisplayStyle, LotCardMediaFrame>> = {
  wall: ONE_FRAME,
  object: ONE_FRAME,
  product: ONE_FRAME,
  showcase: ONE_FRAME,
  document: ONE_FRAME,
};

export function lotCardMediaFrame(style: DepartmentDisplayStyle): LotCardMediaFrame {
  return LOT_CARD_MEDIA_FRAMES[style];
}

const GROUND_CLASS = {
  mat: "marketing-work-mat",
  studio: "marketing-studio-ground",
} as const;

export type LotCardMediaClasses = {
  /** The positioned frame: ratio and ground. */
  frame: string;
  /** The padding of the box the picture fills. */
  inset: string;
  /** Applied to the frame: how its image fits, and the wall shadow where there is one. */
  image: string;
};

/** The classes a card puts on its frame, its inner box and its picture for a display style. */
export function lotCardMediaClasses(style: DepartmentDisplayStyle): LotCardMediaClasses {
  const frame = lotCardMediaFrame(style);
  return {
    frame: [frame.aspect, GROUND_CLASS[frame.ground], frame.shadow ? "marketing-lot-wall" : ""]
      .filter(Boolean)
      .join(" "),
    inset: frame.inset,
    image: [
      frame.fit === "contain" ? "[&_img]:!object-contain" : "[&_img]:!object-cover",
      // The picture's wrapper clips by default; the shadow must be free to fall beyond its box.
      frame.shadow ? "[&>div]:!overflow-visible" : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

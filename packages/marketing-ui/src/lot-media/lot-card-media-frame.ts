import type { DepartmentDisplayStyle } from "@auction/domain";

/**
 * How a lot's picture sits in its card, by department display style. Every lot card on Bid
 * (sale page, search, results, watching, home) reads this one table, so a style looks the same
 * wherever the lot appears.
 *
 * Every style has the same 4:5 box, so titles, estimates and status line up across a row of
 * mixed lots. The style changes only what happens inside the box:
 * - wall: shown whole at its true ratio on the mat, with the soft wall shadow
 * - object: shown whole on a plain studio ground, no shadow
 * - product: fills the box
 * - showcase: shown whole at its own (3:2) ratio across the full width of the box, centred on
 *   the studio ground. A 3:2 car photograph cropped to 4:5 would lose its ends; this keeps the
 *   whole car and still reads as a wide image.
 * - document: the page shown whole on the mat
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

export const LOT_CARD_MEDIA_FRAMES: Readonly<Record<DepartmentDisplayStyle, LotCardMediaFrame>> = {
  wall: { aspect: BOX, inset: "p-[7%]", fit: "contain", ground: "mat", shadow: true },
  object: { aspect: BOX, inset: "p-[7%]", fit: "contain", ground: "studio", shadow: false },
  product: { aspect: BOX, inset: "p-0", fit: "cover", ground: "studio", shadow: false },
  showcase: { aspect: BOX, inset: "p-0", fit: "contain", ground: "studio", shadow: false },
  document: { aspect: BOX, inset: "p-[7%]", fit: "contain", ground: "mat", shadow: false },
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

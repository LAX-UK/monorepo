import type { CoverScrimSetting, UnitPoint, UnitRect } from "@auction/types";
import type { ElementType } from "react";

/** The colour of the type: "light" is white type on a dark scrim, "dark" is ink type on paper. */
export type CoverTone = "light" | "dark";
export type CoverSide = "left" | "right";

/** One art-directed picture: where the subject sits, what must stay in frame, how far to zoom. */
export type CoverPhotoSlot = {
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
  focal: UnitPoint;
  keep?: UnitRect;
  /** 1 shows the whole picture; up to 2.5 shows a detail. */
  zoom: number;
};

/** A cover photograph: the default slot always, a wide and a phone slot when staff made them. */
export type CoverPhotoMedia = {
  kind: "photo";
  alt: string;
  side: CoverSide;
  slots: { default: CoverPhotoSlot; wide?: CoverPhotoSlot; phone?: CoverPhotoSlot };
  /** The measured scrim per text-bearing hero size; a photo without one is not used. */
  scrim: { desktop?: CoverScrimSetting | null; wide?: CoverScrimSetting | null };
  /** The picture's dominant colour, shown while it loads. */
  colour: string;
};

/** The lead work, whole, on a flat field of its own deepest colour (white type passes 13:1). */
export type CoverPlateMedia = {
  kind: "plate";
  alt: string;
  side: CoverSide;
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
  field: string;
  /** Type colour on the field: light on a deep field, dark on a pale one. */
  tone: CoverTone;
};

/** Sources in order of preference. When one fails to load, the next is used; none left, type. */
export type CoverMedia = CoverPhotoMedia | CoverPlateMedia;

export type CoverAction = { label: string; href: string };

/** "Lot 4 · Estuary, Evening (detail) · current bid £7,000"; a link when the lot has a page. */
export type CoverCredit = { text: string; href?: string };

export type CoverSlide = {
  id: string;
  /** Status, such as "Live now". Neutral: one badge style, never an accent. */
  badge?: string;
  /** The time that goes with the status, already worded by the product's time rule. */
  time?: string;
  title: string;
  /** One sentence. Never two. */
  fact?: string;
  primary: CoverAction;
  link?: CoverAction;
  /** Where the person stands, such as "You're approved to bid in this sale". */
  status?: { text: string; icon: "check" | "clock" };
  credit?: CoverCredit;
  media: readonly CoverMedia[];
};

export type MarketingCoverProps = {
  /** One to three slides. More than one adds previous and next; nothing rotates by itself. */
  slides: readonly CoverSlide[];
  /** Names the region for screen readers, for example "Featured sales". */
  label: string;
  /** The app's link component (e.g. `next/link`). */
  Link?: ElementType;
  /** The first slide's picture is the page's largest element: load it eagerly. */
  priority?: boolean;
  className?: string;
};

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

/**
 * A time that counts down in the final hour. `template` holds `{time}` where the clock goes
 * ("Lots close from 21:00 GMT · {time} left"); the page shows the static `time` until it wakes up.
 */
export type CoverTimeTick = { endsAt: string; template: string };

/** An email field before the primary action, which becomes its submit button. */
export type CoverAlert = {
  /** Where the form posts the address (field name `email`). */
  action: string;
  /** The field's accessible name and placeholder, such as "Your email address". */
  fieldLabel: string;
};

/** A film shown in the cover's place when the person presses "Play film". */
export type CoverFilm = {
  /** The embed address, already set to start muted with captions on. Nothing loads until pressed. */
  src: string;
  /** Names the player for screen readers. */
  title: string;
};

/** One row of the season list: "Consign by" / "Fri 4 Dec". */
export type CoverSeasonRow = { label: string; value: string };

export type CoverSlide = {
  id: string;
  /** Status, such as "Live now". Neutral: one badge style, never an accent. */
  badge?: string;
  /** The time that goes with the status, already worded by the product's time rule. */
  time?: string;
  /** Set in the final hour: the time line then updates every second. */
  timeTick?: CoverTimeTick;
  title: string;
  /** One sentence. Never two. */
  fact?: string;
  primary: CoverAction;
  /** Puts an email field before the primary action, which then submits it (between seasons). */
  alert?: CoverAlert;
  link?: CoverAction;
  /** The season ahead, shown on a type cover only: ruled rows under the line of fact. */
  seasons?: readonly CoverSeasonRow[];
  /** Where the person stands, such as "You're approved to bid in this sale". */
  status?: { text: string; icon: "check" | "clock" | "info" };
  /** A sale set to video: the cover stays as its poster and the film plays only when pressed. */
  film?: CoverFilm;
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

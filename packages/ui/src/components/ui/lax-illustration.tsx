import type * as React from "react";
import { LaxDrawingSvg, type LaxIllustrationSize } from "./lax-drawing-svg.js";
import {
  type LaxDrawing,
  askew,
  easel,
  frame,
  gavel,
  ledger,
  lock,
  parcel,
  plinth,
  search,
  ticket,
} from "./lax-drawings.js";

/**
 * The LAX illustration set: quiet line drawings of art-world objects for empty, error, no-access
 * and not-found moments. One set serves every product and the staff tools, so the same moment
 * looks the same everywhere; only the words and the product's action colour change.
 *
 * Drawing rules, so additions stay in the family:
 *   - 160 × 120 grid, objects sit on a shared baseline at y = 108.
 *   - One stroke weight (1.5px on screen at every size, via non-scaling strokes), square ends and
 *     mitred corners, after the straight geometry of the LAX lockups.
 *   - Lines take `currentColor`; supporting lines (baseline, perforations) use the faint tone.
 *   - No fills, no raster, no text. Each drawing is decorative and hidden from assistive tech;
 *     the state's title carries the meaning.
 */
export type LaxIllustrationName =
  /** An empty frame on a wall: nothing here yet (collections, saved works, editorial). */
  | "frame"
  /** An easel with a blank canvas: first use, start something (listings, artworks, drafts). */
  | "easel"
  /** An empty plinth: a list or queue with nothing on show (inboxes, queues, holds). */
  | "plinth"
  /** A gavel over a catalogue: LAX Bid (bids, lots, sales, auctions). */
  | "gavel"
  /** A tied parcel: orders, shipping and fulfilment. */
  | "parcel"
  /** A receipt: money, payouts, invoices and documents. */
  | "ledger"
  /** A magnifier over a frame: no results for a search or filter. */
  | "search"
  /** A padlock: no access. */
  | "lock"
  /** A torn ticket: not found. */
  | "ticket"
  /** A frame hanging askew: something went wrong, calmly. */
  | "askew";

const DRAWINGS: Record<LaxIllustrationName, LaxDrawing> = {
  frame,
  easel,
  plinth,
  gavel,
  parcel,
  ledger,
  search,
  lock,
  ticket,
  askew,
};

export type { LaxIllustrationSize } from "./lax-drawing-svg.js";

export type LaxIllustrationProps = {
  name: LaxIllustrationName;
  size?: LaxIllustrationSize;
  className?: string;
} & Omit<React.SVGProps<SVGSVGElement>, "name" | "children">;

export function LaxIllustration({ name, ...props }: LaxIllustrationProps) {
  return <LaxDrawingSvg name={name} drawing={DRAWINGS[name]} {...props} />;
}

/** The path data of a drawing, by name. */
export function laxDrawing(name: LaxIllustrationName): LaxDrawing {
  return DRAWINGS[name];
}

export const LAX_ILLUSTRATION_NAMES = Object.keys(DRAWINGS) as LaxIllustrationName[];

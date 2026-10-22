import {
  type LaxBrandProduct,
  PRODUCT_ACCENTS,
  PRODUCT_ACCENTS_ON_DARK,
} from "../brand-identity.js";
import {
  BID_DESCRIPTOR_PATHS,
  BID_MARK_INK_PATHS,
  BID_MARK_MIST_PATHS,
  BID_TAGLINE_PATHS,
} from "./bid-lockup-parts.js";
import { DESCRIPTOR_FONT_CAP_HEIGHT, DESCRIPTOR_GLYPHS } from "./descriptor-glyphs.js";
import { LAX_MARK_BOUNDS, LAX_MARK_INK_PATHS, LAX_MARK_MIST_PATHS } from "./lax-mark-paths.js";

/**
 * LAX lockups: the LAX mark with a product descriptor at its lower right, one geometry for every
 * product. The geometry is Bid's: the descriptor is a dot followed by capitals, and its
 * baseline, cap height and left edge are fixed by the ".BID" of the Bid lockup master.
 *
 * Descriptor letters: Bid's BID is drawn in a face we do not have as a font, so its outlines are
 * copied unchanged. Every other word is Montserrat (the shared LAX face) converted to outlines at
 * the weight where its stem matches BID's, so nothing depends on a font being loaded.
 */

export type LaxLockupKind = "mark" | LaxBrandProduct;
export type LaxLockupScheme = "light" | "dark";

export type LockupPath = { d: string; transform?: string };

export type LaxLockup = {
  kind: LaxLockupKind;
  /** Accessible name, e.g. "LAX Account". */
  label: string;
  /** The word under the mark, absent on the bare mark. */
  descriptor: string | null;
  viewBox: string;
  width: number;
  height: number;
  ink: readonly LockupPath[];
  mist: readonly LockupPath[];
  descriptorPaths: readonly LockupPath[];
};

export const LAX_LOCKUP_DESCRIPTORS: Readonly<Record<LaxBrandProduct, string>> = {
  bid: "BID",
  shop: "SHOP",
  art: "ART",
  account: "ACCOUNT",
};

const LABELS: Readonly<Record<LaxLockupKind, string>> = {
  mark: "LAX",
  bid: "LAX Bid",
  shop: "LAX Shop",
  art: "LAX Art",
  account: "LAX Account",
};

/** Geometry measured from the Bid lockup master (1108.21 x 287.96 canvas). */
const BID_CANVAS = { width: 1108.21, height: 287.96 } as const;
const DESCRIPTOR_BASELINE = 287.42;
const DESCRIPTOR_CAP_HEIGHT = 46.14;
/** Left edge of the first capital, after the dot. */
const DESCRIPTOR_FIRST_LETTER_X = 649.25;
/** Space added between capitals; Montserrat's own spacing is tighter than BID's. */
const DESCRIPTOR_TRACKING = 4.4;
const GLYPH_SCALE = DESCRIPTOR_CAP_HEIGHT / DESCRIPTOR_FONT_CAP_HEIGHT;
const FRAME_BOTTOM = BID_CANVAS.height;
/**
 * The plain mark's X (and slash) sit this far left of Bid's, as in the shared raster logo. The
 * descriptor moves with it so its distance from the mark matches Bid's.
 */
const PLAIN_MARK_SHIFT_X = -18;

const round = (value: number): number => Math.round(value * 10000) / 10000;

const plain = (paths: readonly string[]): LockupPath[] => paths.map((d) => ({ d }));

function descriptorDot(): LockupPath {
  const [dot] = BID_DESCRIPTOR_PATHS;
  if (dot === undefined) throw new Error("Bid descriptor is missing its dot");
  return { d: dot, transform: `translate(${PLAIN_MARK_SHIFT_X} 0)` };
}

/** Lays the capitals of `word` out right of the dot; returns the paths and the right ink edge. */
function setDescriptor(word: string): { paths: LockupPath[]; right: number } {
  const paths: LockupPath[] = [descriptorDot()];
  let pen = 0;
  let right = 0;
  [...word].forEach((letter, index) => {
    const glyph = DESCRIPTOR_GLYPHS[letter];
    if (glyph === undefined) throw new Error(`No outline for descriptor letter "${letter}"`);
    if (index === 0) {
      pen = DESCRIPTOR_FIRST_LETTER_X + PLAIN_MARK_SHIFT_X - glyph.xMin * GLYPH_SCALE;
    }
    paths.push({
      d: glyph.d,
      transform: `translate(${round(pen)} ${DESCRIPTOR_BASELINE}) scale(${round(GLYPH_SCALE)})`,
    });
    right = pen + glyph.xMax * GLYPH_SCALE;
    pen += glyph.advance * GLYPH_SCALE + DESCRIPTOR_TRACKING;
  });
  return { paths, right };
}

const format = (value: number): string => String(Math.round(value * 100) / 100);

function frame(width: number, y: number, height: number) {
  return {
    viewBox: `0 ${format(y)} ${format(width)} ${format(height)}`,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
  };
}

export function laxLockup(kind: LaxLockupKind): LaxLockup {
  const base = { kind, label: LABELS[kind] };
  const markInk = plain(LAX_MARK_INK_PATHS);

  if (kind === "mark") {
    return {
      ...base,
      mist: plain(LAX_MARK_MIST_PATHS),
      descriptor: null,
      ...frame(LAX_MARK_BOUNDS.width, LAX_MARK_BOUNDS.y, LAX_MARK_BOUNDS.height),
      ink: markInk,
      descriptorPaths: [],
    };
  }

  if (kind === "bid") {
    return {
      ...base,
      mist: plain(BID_MARK_MIST_PATHS),
      descriptor: LAX_LOCKUP_DESCRIPTORS.bid,
      viewBox: `0 0 ${BID_CANVAS.width} ${BID_CANVAS.height}`,
      width: BID_CANVAS.width,
      height: BID_CANVAS.height,
      // The tagline and the gavel in the A are Bid's alone: the gavel reads as an auction, so every
      // other product uses the plain mark and shows only a descriptor.
      ink: [...plain(BID_TAGLINE_PATHS), ...plain(BID_MARK_INK_PATHS)],
      descriptorPaths: plain(BID_DESCRIPTOR_PATHS),
    };
  }

  const word = LAX_LOCKUP_DESCRIPTORS[kind];
  const { paths, right } = setDescriptor(word);
  return {
    ...base,
    mist: plain(LAX_MARK_MIST_PATHS),
    descriptor: word,
    ...frame(right, LAX_MARK_BOUNDS.y, FRAME_BOTTOM - LAX_MARK_BOUNDS.y),
    ink: markInk,
    descriptorPaths: paths,
  };
}

export type LaxLockupColors = { ink: string; mist: string; descriptor: string };

const INK: Readonly<Record<LaxLockupScheme, string>> = { light: "#010101", dark: "#ffffff" };
const MIST = "#b9bac0";
/** Bid's lockup navy and its dark-surface descriptor, kept exactly as in the master. */
const BID_DESCRIPTOR: Readonly<Record<LaxLockupScheme, string>> = {
  light: "#202759",
  dark: MIST,
};

/**
 * Descriptor colour: the product accent (re-tuned for dark surfaces), or the neutral ink while the
 * product has no accent. Bid keeps the navy of its master, which is a touch lighter than
 * `PRODUCT_ACCENTS.bid`.
 */
export function laxLockupColors(kind: LaxLockupKind, scheme: LaxLockupScheme): LaxLockupColors {
  const ink = INK[scheme];
  const accent =
    kind === "mark"
      ? null
      : kind === "bid"
        ? BID_DESCRIPTOR[scheme]
        : scheme === "light"
          ? PRODUCT_ACCENTS[kind]
          : PRODUCT_ACCENTS_ON_DARK[kind];
  return { ink, mist: MIST, descriptor: accent ?? ink };
}

function pathElement({ d, transform }: LockupPath): string {
  return transform === undefined ? `<path d="${d}"/>` : `<path transform="${transform}" d="${d}"/>`;
}

function group(fill: string, paths: readonly LockupPath[]): string {
  return paths.length === 0 ? "" : `<g fill="${fill}">${paths.map(pathElement).join("")}</g>`;
}

/** A standalone SVG file for a lockup in one colour scheme. */
export function laxLockupSvg(kind: LaxLockupKind, scheme: LaxLockupScheme): string {
  const lockup = laxLockup(kind);
  const colors = laxLockupColors(kind, scheme);
  return `${[
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${lockup.viewBox}" width="${lockup.width}" height="${lockup.height}" role="img">`,
    `<title>${lockup.label}</title>`,
    group(colors.ink, lockup.ink),
    group(colors.mist, lockup.mist),
    group(colors.descriptor, lockup.descriptorPaths),
    "</svg>",
  ]
    .filter((line) => line !== "")
    .join("\n")}\n`;
}

export const LAX_LOCKUP_KINDS: readonly LaxLockupKind[] = ["mark", "bid", "shop", "art", "account"];

/** Published file name of a lockup, relative to `@auction/branding/lockups/`. */
export function laxLockupFileName(kind: LaxLockupKind, scheme: LaxLockupScheme): string {
  return `lax-${kind}${scheme === "dark" ? "-dark" : ""}.svg`;
}

import {
  type LaxBrandProduct,
  PRODUCT_ACCENTS,
  PRODUCT_ACCENTS_ON_DARK,
} from "../brand-identity.js";
import { ACCOUNT_NAME_BOUNDS, ACCOUNT_NAME_PATHS } from "./account-name-paths.js";
import {
  BID_DESCRIPTOR_PATHS,
  BID_MARK_INK_PATHS,
  BID_MARK_MIST_PATHS,
  BID_TAGLINE_PATHS,
} from "./bid-lockup-parts.js";
import { DESCRIPTOR_FONT_CAP_HEIGHT, DESCRIPTOR_GLYPHS } from "./descriptor-glyphs.js";
import { LAX_MARK_BOUNDS, LAX_MARK_INK_PATHS, LAX_MARK_MIST_PATHS } from "./lax-mark-paths.js";
import { TAGLINE_BOUNDS, TAGLINE_PATHS } from "./tagline-paths.js";

/**
 * LAX lockups: the LAX mark with a product descriptor at its lower right, one geometry for every
 * product. The geometry is Bid's: the descriptor is a dot followed by capitals, and its
 * baseline, cap height and left edge are fixed by the ".BID" of the Bid lockup master.
 *
 * Descriptor letters: Bid's BID is drawn in a face we do not have as a font, so its outlines are
 * copied unchanged. Every other word is Montserrat (the shared LAX face) converted to outlines at
 * the weight where its stem matches BID's, so nothing depends on a font being loaded.
 */

/**
 * `bid-compact` is Bid's mark and ".BID" without the "Auction Xchange" tagline, framed like the
 * Shop, Art and Account lockups so the four read at one size in a row of product cards.
 */
/**
 * `account` is the full Account lockup, built like Bid's: the plain mark, a two-line name ("Account
 * / Centre(R)") set to Bid's measurements, and the Account tag (see ACCOUNT_TAG) in the descriptor position where Bid has
 * ".BID". `account-compact` is the mark and the tag without the name, framed like the Shop and
 * Art lockups, for rows of product cards.
 */
/**
 * `exchange` is the plain mark with the three-line "London / Art Exchange(R) / Marylebone" tagline,
 * the vector form of the wordmark Shop and Art show in their headers and footers.
 */
export type LaxLockupKind =
  | "mark"
  | LaxBrandProduct
  | "bid-compact"
  | "account-compact"
  | "exchange";
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

/**
 * The tag after the dot in Account's lockup. "Account" is already in the name, so the tag says
 * what the product is for. Two candidates were drawn, "ID" and "IDENTITY"; change this one line
 * (then run generate:lockups) to switch. Everything else reads it from here.
 */
export const ACCOUNT_TAG = "ID";

export const LAX_LOCKUP_DESCRIPTORS: Readonly<Record<LaxBrandProduct, string>> = {
  bid: "BID",
  shop: "SHOP",
  art: "ART",
  account: ACCOUNT_TAG,
};

const LABELS: Readonly<Record<LaxLockupKind, string>> = {
  mark: "LAX",
  bid: "LAX Bid",
  "bid-compact": "LAX Bid",
  exchange: "LAX London Art Exchange",
  shop: "LAX Shop",
  art: "lax.art",
  account: "LAX Account",
  "account-compact": "LAX Account",
};

/** Right edge of the "D" in the Bid master's ".BID", plus a hair so the stroke is not clipped. */
const BID_DESCRIPTOR_RIGHT = 765;

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

/** Clear space right of the Account name's last ink so antialiasing is not clipped. */
const ACCOUNT_FRAME_PAD = 0.5;

/** Clear space around the tagline's outermost ink so antialiasing is not clipped. */
const EXCHANGE_FRAME_PAD = 0.5;

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

/**
 * The family descriptor (dot plus capitals) for `word`, at its standard size and position: the
 * baseline at the foot of the mark and the dot at the start of the text column.
 */
export function laxDescriptor(word: string): { paths: LockupPath[]; right: number } {
  return setDescriptor(word);
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

  if (kind === "exchange") {
    const top = Math.floor(TAGLINE_BOUNDS.y) - EXCHANGE_FRAME_PAD;
    const bottom = Math.ceil(TAGLINE_BOUNDS.bottom) + EXCHANGE_FRAME_PAD;
    return {
      ...base,
      mist: plain(LAX_MARK_MIST_PATHS),
      descriptor: null,
      ...frame(Math.ceil(TAGLINE_BOUNDS.right) + EXCHANGE_FRAME_PAD, top, bottom - top),
      // The tagline is ink like the mark's strokes, so it follows the text colour with them.
      ink: [...markInk, ...plain(TAGLINE_PATHS)],
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

  if (kind === "bid-compact") {
    return {
      ...base,
      mist: plain(BID_MARK_MIST_PATHS),
      descriptor: LAX_LOCKUP_DESCRIPTORS.bid,
      ...frame(BID_DESCRIPTOR_RIGHT, LAX_MARK_BOUNDS.y, FRAME_BOTTOM - LAX_MARK_BOUNDS.y),
      ink: plain(BID_MARK_INK_PATHS),
      descriptorPaths: plain(BID_DESCRIPTOR_PATHS),
    };
  }

  if (kind === "account") {
    const word = LAX_LOCKUP_DESCRIPTORS.account;
    const width = Math.ceil(ACCOUNT_NAME_BOUNDS.right) + ACCOUNT_FRAME_PAD;
    return {
      ...base,
      mist: plain(LAX_MARK_MIST_PATHS),
      descriptor: word,
      // Bid's canvas height, so the two full lockups render at one height at one CSS height.
      viewBox: `0 0 ${format(width)} ${BID_CANVAS.height}`,
      width,
      height: BID_CANVAS.height,
      ink: [...markInk, ...plain(ACCOUNT_NAME_PATHS)],
      descriptorPaths: setDescriptor(word).paths,
    };
  }

  const word = LAX_LOCKUP_DESCRIPTORS[kind === "account-compact" ? "account" : kind];
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
    kind === "mark" || kind === "exchange"
      ? null
      : kind === "bid" || kind === "bid-compact"
        ? BID_DESCRIPTOR[scheme]
        : scheme === "light"
          ? PRODUCT_ACCENTS[kind === "account-compact" ? "account" : kind]
          : PRODUCT_ACCENTS_ON_DARK[kind === "account-compact" ? "account" : kind];
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

export const LAX_LOCKUP_KINDS: readonly LaxLockupKind[] = [
  "mark",
  "exchange",
  "bid",
  "bid-compact",
  "shop",
  "art",
  "account",
  "account-compact",
];

/**
 * A standalone SVG that picks its own colours with `prefers-color-scheme`, for `<img>` contexts
 * that follow the operating system and have no theme of their own. The scheme-specific files stay
 * the right choice wherever the surface colour is known (emails, social images).
 */
export function laxLockupAutoSvg(kind: LaxLockupKind): string {
  const lockup = laxLockup(kind);
  const light = laxLockupColors(kind, "light");
  const dark = laxLockupColors(kind, "dark");
  const hasDescriptor = lockup.descriptorPaths.length > 0;
  const style = [
    `.i{fill:${light.ink}}.m{fill:${light.mist}}`,
    hasDescriptor ? `.d{fill:${light.descriptor}}` : "",
    `@media(prefers-color-scheme:dark){.i{fill:${dark.ink}}`,
    hasDescriptor ? `.d{fill:${dark.descriptor}}` : "",
    "}",
  ].join("");
  const classed = (name: string, paths: readonly LockupPath[]) =>
    paths.length === 0 ? "" : `<g class="${name}">${paths.map(pathElement).join("")}</g>`;
  return `${[
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${lockup.viewBox}" width="${lockup.width}" height="${lockup.height}" role="img">`,
    `<title>${lockup.label}</title>`,
    `<style>${style}</style>`,
    classed("i", lockup.ink),
    classed("m", lockup.mist),
    classed("d", lockup.descriptorPaths),
    "</svg>",
  ]
    .filter((line) => line !== "")
    .join("\n")}\n`;
}

/** Published file name of a lockup, relative to `@auction/branding/lockups/`. */
export function laxLockupFileName(kind: LaxLockupKind, scheme: LaxLockupScheme | "auto"): string {
  return `lax-${kind}${scheme === "light" ? "" : `-${scheme}`}.svg`;
}

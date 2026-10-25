import type * as React from "react";
import { cn } from "../../lib/utils.js";

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

export type LaxIllustrationSize = "page" | "panel" | "compact";

type Group = { d: readonly string[]; faint?: true; transform?: string };

const BASELINE: Group = { d: ["M24 108H136"], faint: true };

const NAIL = "M81.5 16a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0";

const DRAWINGS: Record<LaxIllustrationName, readonly Group[]> = {
  frame: [
    { d: [NAIL, "M60 34L80 16L100 34", "M50 34H110V100H50Z", "M60 44H100V90H60Z"] },
    BASELINE,
  ],
  easel: [
    {
      d: [
        "M58 30H102V76H58Z",
        "M52 76H108",
        "M80 14V30",
        "M68 76L59 108",
        "M92 76L101 108",
        "M80 76V102",
      ],
    },
    BASELINE,
  ],
  plinth: [
    { d: ["M56 52L68 44H112L100 52Z", "M56 52H100V108H56Z", "M100 52L112 44V100L100 108"] },
    BASELINE,
  ],
  gavel: [
    { d: ["M34 42H74V108H34Z", "M41 42V108", "M50 58H66", "M50 65H62", "M94 100H134V108H94Z"] },
    {
      d: ["M98 58H126V74H98Z", "M104 58V74", "M120 58V74", "M112 74V96"],
      transform: "rotate(-28 112 70)",
    },
    BASELINE,
  ],
  parcel: [
    {
      d: [
        "M44 58H96V108H44Z",
        "M44 58L62 44H114L96 58",
        "M96 58L114 44V94L96 108",
        "M70 58V108",
        "M70 58L88 44",
        "M96 83L114 69",
        "M50 90H62V100H50Z",
      ],
    },
    BASELINE,
  ],
  ledger: [
    {
      d: [
        "M56 20H104V100L98 96L92 100L86 96L80 100L74 96L68 100L62 96L56 100Z",
        "M66 34H94",
        "M66 42H86",
        "M66 50H90",
        "M80 78H94",
        "M84 86H94",
      ],
    },
    { d: ["M66 68H94"], faint: true },
    BASELINE,
  ],
  search: [
    {
      d: [
        "M36 24H100V90H36Z",
        "M46 34H90V80H46Z",
        "M120 78a18 18 0 1 1-36 0a18 18 0 1 1 36 0",
        "M115 91L131 107",
      ],
    },
    BASELINE,
  ],
  lock: [
    {
      d: [
        "M66 58V44a14 14 0 0 1 28 0V58",
        "M56 58H104V104H56Z",
        "M84 76a4 4 0 1 1-8 0a4 4 0 1 1 8 0",
        "M80 80V90",
      ],
    },
    BASELINE,
  ],
  ticket: [
    {
      d: [
        "M28 44H90L86 50L92 56L86 62L92 68L86 74L90 80H28V68a6 6 0 0 0 0-12Z",
        "M52 56H76",
        "M52 64H70",
      ],
      transform: "translate(0 24)",
    },
    { d: ["M42 48V76"], faint: true, transform: "translate(0 24)" },
    {
      d: ["M104 44L100 50L106 56L100 62L106 68L100 74L104 80H130V68a6 6 0 0 1 0-12V44Z"],
      transform: "translate(0 24) rotate(10 116 62)",
    },
    BASELINE,
  ],
  askew: [
    { d: [NAIL] },
    {
      d: ["M60 34L80 16L100 34", "M50 34H110V100H50Z", "M60 44H100V90H60Z"],
      transform: "rotate(7 80 16)",
    },
    BASELINE,
  ],
};

/** Rendered widths; height follows the 4:3 grid. Compact sits in tables and staff panels. */
const SIZE_CLASS: Record<LaxIllustrationSize, string> = {
  page: "w-40",
  panel: "w-32",
  compact: "w-20",
};

/** Fade up once on first paint; still for anyone who prefers reduced motion. */
const MOTION_CSS =
  "@media (prefers-reduced-motion:no-preference){.lax-illustration{animation:lax-illustration-in .7s cubic-bezier(.2,.6,.2,1) both}}@keyframes lax-illustration-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}";

export type LaxIllustrationProps = {
  name: LaxIllustrationName;
  size?: LaxIllustrationSize;
  className?: string;
} & Omit<React.SVGProps<SVGSVGElement>, "name" | "children">;

export function LaxIllustration({
  name,
  size = "panel",
  className,
  ...props
}: LaxIllustrationProps) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      data-illustration={name}
      className={cn(
        "lax-illustration block h-auto shrink-0 text-on-surface-variant",
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      <style>{MOTION_CSS}</style>
      {DRAWINGS[name].map((group) => (
        <g
          key={group.d[0]}
          {...(group.transform ? { transform: group.transform } : {})}
          {...(group.faint ? { opacity: 0.4 } : {})}
        >
          {group.d.map((d) => (
            <path key={d} d={d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ))}
    </svg>
  );
}

export const LAX_ILLUSTRATION_NAMES = Object.keys(DRAWINGS) as LaxIllustrationName[];

/**
 * The LAX drawings as path data, one export per drawing, so a component that needs a single
 * drawing (a route error boundary, which always draws `askew`) imports only that one. The
 * rules of the set are on `LaxIllustration` in `./lax-illustration.tsx`.
 */
export type LaxDrawingGroup = { d: readonly string[]; faint?: true; transform?: string };
export type LaxDrawing = readonly LaxDrawingGroup[];

const BASELINE: LaxDrawingGroup = { d: ["M24 108H136"], faint: true };

const NAIL = "M81.5 16a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0";

export const frame: LaxDrawing = [
  { d: [NAIL, "M60 34L80 16L100 34", "M50 34H110V100H50Z", "M60 44H100V90H60Z"] },
  BASELINE,
];

export const easel: LaxDrawing = [
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
];

export const plinth: LaxDrawing = [
  { d: ["M56 52L68 44H112L100 52Z", "M56 52H100V108H56Z", "M100 52L112 44V100L100 108"] },
  BASELINE,
];

export const gavel: LaxDrawing = [
  { d: ["M34 42H74V108H34Z", "M41 42V108", "M50 58H66", "M50 65H62", "M94 100H134V108H94Z"] },
  {
    d: ["M98 58H126V74H98Z", "M104 58V74", "M120 58V74", "M112 74V96"],
    transform: "rotate(-28 112 70)",
  },
  BASELINE,
];

export const parcel: LaxDrawing = [
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
];

export const ledger: LaxDrawing = [
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
];

export const search: LaxDrawing = [
  {
    d: [
      "M36 24H100V90H36Z",
      "M46 34H90V80H46Z",
      "M120 78a18 18 0 1 1-36 0a18 18 0 1 1 36 0",
      "M115 91L131 107",
    ],
  },
  BASELINE,
];

export const lock: LaxDrawing = [
  {
    d: [
      "M66 58V44a14 14 0 0 1 28 0V58",
      "M56 58H104V104H56Z",
      "M84 76a4 4 0 1 1-8 0a4 4 0 1 1 8 0",
      "M80 80V90",
    ],
  },
  BASELINE,
];

export const ticket: LaxDrawing = [
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
];

export const askew: LaxDrawing = [
  { d: [NAIL] },
  {
    d: ["M60 34L80 16L100 34", "M50 34H110V100H50Z", "M60 44H100V90H60Z"],
    transform: "rotate(7 80 16)",
  },
  BASELINE,
];

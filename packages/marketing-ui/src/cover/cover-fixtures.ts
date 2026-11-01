import type { CoverPhotoMedia, CoverPlateMedia, CoverSlide, CoverTone } from "./cover-types.js";

/**
 * Every design scenario as cover data, for the review fixture page and for tests. The pictures
 * are generated abstract works (inline SVG), so a fixture needs no network or files. This module
 * is imported only by the fixture route, which answers 404 in production.
 */

export type CoverFixture = {
  id: string;
  label: string;
  note: string;
  slides: CoverSlide[];
};

type Palette = { sky: string; mid: string; low: string; accent: string; deep: string };

const PALETTES: Record<string, Palette> = {
  estuary: { sky: "#9fb6c6", mid: "#3e6a86", low: "#c9a46b", accent: "#f0d9a8", deep: "#162936" },
  autumn: { sky: "#e8e1d2", mid: "#d6cdb8", low: "#bfb59c", accent: "#f4efe3", deep: "#8a8062" },
  ochre: { sky: "#6b4a1e", mid: "#b8832e", low: "#2c1f0d", accent: "#f2d58f", deep: "#2c1f0d" },
  harbour: { sky: "#2c3d52", mid: "#51708f", low: "#d89a5a", accent: "#f4d9a4", deep: "#1b2735" },
  longfield: { sky: "#e6dfc9", mid: "#9aa56a", low: "#5d6b3a", accent: "#f7f1da", deep: "#3c4727" },
  november: { sky: "#4a3a30", mid: "#7a5a43", low: "#2a1f19", accent: "#e7c59a", deep: "#2a1f19" },
  nightgarden: {
    sky: "#16233a",
    mid: "#2f4d6e",
    low: "#0c1424",
    accent: "#e8d27a",
    deep: "#0c1424",
  },
  vessel: { sky: "#f1e4df", mid: "#d8a99e", low: "#b5776a", accent: "#fff6f1", deep: "#6f3d35" },
  reed: { sky: "#e8ecdf", mid: "#a8b78e", low: "#6f8456", accent: "#fbfdf4", deep: "#3a4a2a" },
  gallery: { sky: "#cfc8bd", mid: "#a39a8b", low: "#6e6558", accent: "#f2ede4", deep: "#3b352c" },
};

/** An abstract picture as an inline SVG: bands of colour, a low sun and a few strokes. */
export function fixtureArtwork(
  name: keyof typeof PALETTES | string,
  width: number,
  height: number,
) {
  const p = PALETTES[name] ?? PALETTES.estuary;
  if (!p) throw new Error("fixture_palette_missing");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky}"/><stop offset="1" stop-color="${p.mid}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#s)"/><circle cx="${width * 0.7}" cy="${height * 0.42}" r="${height * 0.13}" fill="${p.accent}" opacity=".9"/><path d="M0 ${height * 0.62} C ${width * 0.25} ${height * 0.55}, ${width * 0.5} ${height * 0.7}, ${width} ${height * 0.58} V ${height} H 0 Z" fill="${p.low}"/><path d="M0 ${height * 0.8} C ${width * 0.3} ${height * 0.72}, ${width * 0.6} ${height * 0.9}, ${width} ${height * 0.78} V ${height} H 0 Z" fill="${p.deep}" opacity=".8"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function blur(name: string): string {
  return fixtureArtwork(name, 24, 14);
}

const WIDE = { width: 3200, height: 1400 } as const;

function photo(
  name: string,
  tone: CoverTone,
  strength: number,
  over: Partial<CoverPhotoMedia> & { width?: number; height?: number; zoom?: number } = {},
): CoverPhotoMedia {
  const { width = WIDE.width, height = WIDE.height, zoom = 1, ...rest } = over;
  return {
    kind: "photo",
    alt: "A work from the sale",
    side: "left",
    slots: {
      default: {
        src: fixtureArtwork(name, width, height),
        width,
        height,
        blurDataURL: blur(name),
        focal: { x: 0.72, y: 0.5 },
        zoom,
      },
    },
    scrim: { desktop: { tone, strength, creditBand: 0.5 } },
    colour: PALETTES[name]?.mid ?? "#3e6a86",
    ...rest,
  };
}

function plate(
  name: string,
  field: string,
  tone: CoverTone,
  size: { width: number; height: number } = { width: 1200, height: 1500 },
): CoverPlateMedia {
  return {
    kind: "plate",
    alt: "The lead work, shown whole",
    side: "left",
    src: fixtureArtwork(name, size.width, size.height),
    width: size.width,
    height: size.height,
    blurDataURL: blur(name),
    field,
    tone,
  };
}

const LIVE: CoverSlide = {
  id: "live",
  badge: "Live",
  time: "Closes from Tue 3 Nov, 21:00 GMT · 2 days 5 hours left",
  title: "Modern & Contemporary: Online",
  fact: "British and European paintings and works on paper · 8 lots, bid online",
  primary: { label: "View lots", href: "#lots" },
  link: { label: "Register to bid", href: "#register" },
  credit: { text: "Lot 4 · Estuary, Evening (detail) · current bid £7,000", href: "#lot-4" },
  media: [photo("estuary", "light", 0.45, { zoom: 1.2 })],
};

const UPCOMING: CoverSlide = {
  id: "upcoming",
  badge: "Upcoming",
  time: "Opens Tue 10 Nov, 21:00 GMT",
  title: "Winter Evening Sale",
  fact: "LAX Mayfair Saleroom and online · 6 lots · viewing open now",
  primary: { label: "Preview the lots", href: "#lots" },
  link: { label: "Remind me when it opens", href: "#remind" },
  credit: { text: "Lot 1 · The Valley in Spring (detail) · opening bid £8,400", href: "#lot-1" },
  media: [photo("ochre", "light", 0.6, { zoom: 1.45 })],
};

const ALERT = { action: "#notify", fieldLabel: "Your email address" } as const;

const BETWEEN: CoverSlide = {
  id: "between",
  time: "Between sales",
  title: "The winter season is in preparation",
  fact: "New sales are announced here first. Consign by Fri 4 Dec for February.",
  primary: { label: "Notify me", href: "#notify" },
  alert: ALERT,
  link: { label: "Sell with LAX", href: "#sell" },
  credit: {
    text: "Recently sold · Red Kite (detail) · £1,875, Autumn Works on Paper",
    href: "#lot",
  },
  media: [photo("longfield", "dark", 0.47, { zoom: 1.3 })],
};

const SHOP_RELEASE: CoverSlide = {
  id: "release",
  time: "New release · 28 Oct 2026",
  title: "Vessel Study",
  fact: "A new limited edition by Flora Powers · giclée on archival paper, 120 × 90 cm",
  primary: { label: "See the edition", href: "#edition" },
  link: { label: "Browse all editions", href: "#editions" },
  credit: { text: "Flora Powers · Vessel Study · edition of 24 · £120", href: "#edition" },
  media: [plate("vessel", "#eee3df", "dark", { width: 800, height: 1000 })],
};

export const BID_COVER_FIXTURES: readonly CoverFixture[] = [
  {
    id: "live",
    label: "Live",
    note: "A staff-chosen detail of lot 4, credited and linked. The measured scrim sits at the 0.45 floor.",
    slides: [LIVE],
  },
  {
    id: "hour",
    label: "Live, final hour",
    note: "Seconds appear only in the final hour. The line of fact names the next lot to close.",
    slides: [
      {
        ...LIVE,
        id: "hour",
        time: "Lots close from 21:00 GMT · 42:18 to the first close",
        timeTick: {
          endsAt: new Date(Date.now() + 42 * 60_000 + 18_000).toISOString(),
          template: "Lots close from 21:00 GMT · {time} to the first close",
        },
        fact: "Lot 1, Harbour at First Light, closes first · current bid £4,200",
        primary: { label: "View lots closing first", href: "#lots" },
        link: { label: "How closing works", href: "#closing" },
      },
    ],
  },
  {
    id: "finalising",
    label: "Just ended, finalising",
    note: "A pale room, so the measurement chose dark type on a light scrim.",
    slides: [
      {
        id: "finalising",
        badge: "Ended",
        time: "Ended today, 21:00 GMT",
        title: "Autumn Works on Paper",
        fact: "Results are being finalised. Sold prices appear as each lot is confirmed.",
        primary: { label: "See results so far", href: "#results" },
        link: { label: "Next sale opens Tue 10 Nov", href: "#next" },
        credit: { text: "Sale cover · viewing room" },
        media: [photo("autumn", "dark", 0.46)],
      },
    ],
  },
  {
    id: "upcoming",
    label: "Upcoming",
    note: "Nine days away, so a date and not a countdown.",
    slides: [UPCOMING],
  },
  {
    id: "recent",
    label: "Recent results",
    note: "The top lot is the cover and its price is in the credit.",
    slides: [
      {
        id: "recent",
        badge: "Ended",
        time: "Ended Thu 15 Oct",
        title: "September Modern British",
        fact: "All 4 lots sold · £17,125 with buyer’s premium",
        primary: { label: "See the results", href: "#results" },
        link: { label: "Sell with LAX", href: "#sell" },
        credit: {
          text: "Top lot · Lot 3 · The Lock Keeper’s House (detail) · sold for £7,750",
          href: "#lot-3",
        },
        media: [photo("harbour", "light", 0.52, { zoom: 1.3 })],
      },
    ],
  },
  {
    id: "between",
    label: "Between seasons",
    note: "A recently sold work is the cover.",
    slides: [BETWEEN],
  },
  {
    id: "pinned",
    label: "Three pinned sales",
    note: "Previous, 1 of 3 and next. Nothing changes by itself, so there is no pause button.",
    slides: [
      LIVE,
      {
        ...UPCOMING,
        id: "pinned-2",
        title: "The November Room: Mayfair Live",
        badge: "Live in the room",
        time: "Lot 2 of 5 on the block",
        media: [photo("november", "light", 0.55)],
      },
      {
        ...UPCOMING,
        id: "pinned-3",
        media: [photo("nightgarden", "light", 0.5, { side: "right" })],
      },
    ],
  },
  {
    id: "hybrid",
    label: "In the room",
    note: "The one place a room belongs on the cover, because the room is the news.",
    slides: [
      {
        id: "hybrid",
        badge: "Live in the room",
        time: "LAX Mayfair Saleroom and online · Lot 2 of 5 on the block",
        title: "The November Room: Mayfair Live",
        fact: "Bid online with the room, or watch the auctioneer live.",
        primary: { label: "Join the saleroom", href: "#saleroom" },
        link: { label: "View lots", href: "#lots" },
        credit: { text: "Sale cover · the saleroom" },
        media: [photo("november", "light", 0.55)],
      },
    ],
  },
  {
    id: "no-cover",
    label: "No cover image",
    note: "The lead lot hangs whole on a flat field of its own deepest blue.",
    slides: [
      {
        ...LIVE,
        id: "no-cover",
        credit: { text: "Lot 4 · Estuary, Evening · current bid £7,000", href: "#lot-4" },
        media: [plate("estuary", "#162936", "light", { width: 1500, height: 1000 })],
      },
    ],
  },
  {
    id: "poor-image",
    label: "Poor image",
    note: "A 640px cover is below the floor and never stretched; the plate leads instead.",
    slides: [
      {
        ...UPCOMING,
        id: "poor",
        credit: { text: "Lot 1 · The Valley in Spring · opening bid £8,400", href: "#lot-1" },
        media: [plate("ochre", "#2c1f0d", "light", { width: 900, height: 1200 })],
      },
    ],
  },
  {
    id: "landscape",
    label: "Landscape work",
    note: "A wide work on the plate keeps its proportions.",
    slides: [
      {
        ...LIVE,
        id: "landscape",
        credit: { text: "Lot 6 · The Long Field · current bid £1,900", href: "#lot-6" },
        media: [plate("longfield", "#3c4727", "light", { width: 1600, height: 900 })],
      },
    ],
  },
  {
    id: "long-title",
    label: "Very long title",
    note: "95 characters step down to 36/44 and are never cut. The text moves to the right.",
    slides: [
      {
        ...UPCOMING,
        id: "long",
        time: "Opens Thu 26 Nov, 18:00 GMT",
        title:
          "Modern British and Irish Art, including Works from the Estate of the Late Lady Margaret Ashcombe",
        fact: "Online, timed · 42 lots",
        media: [photo("nightgarden", "light", 0.5, { side: "right" })],
      },
    ],
  },
  {
    id: "approved",
    label: "Signed in, approved",
    note: "The register prompt gives way to the next real step.",
    slides: [
      {
        ...LIVE,
        id: "approved",
        link: { label: "Your bids", href: "#bids" },
        status: { icon: "check", text: "You’re approved to bid in this sale" },
      },
    ],
  },
  {
    id: "pending",
    label: "Signed in, pending",
    note: "Pending is calm and specific.",
    slides: [
      {
        ...LIVE,
        id: "pending",
        link: { label: "Check your registration", href: "#registration" },
        status: {
          icon: "clock",
          text: "Registration pending. We’ll email you when it’s approved.",
        },
      },
    ],
  },
  {
    id: "no-images",
    label: "No images at all",
    note: "Type only, on the paper tone. No placeholder.",
    slides: [
      {
        id: "type",
        time: "Between sales",
        title: "The winter season is in preparation",
        fact: "New sales are announced here first. Leave your email for one message when the next sale is announced.",
        primary: { label: "Notify me", href: "#notify" },
        alert: ALERT,
        seasons: [
          { label: "Consign by", value: "Fri 4 Dec" },
          { label: "February", value: "Modern British" },
          { label: "March", value: "Works on paper" },
        ],
        link: { label: "Sell with LAX", href: "#sell" },
        media: [],
      },
    ],
  },
];

export const SHOP_COVER_FIXTURES: readonly CoverFixture[] = [
  {
    id: "release",
    label: "New release",
    note: "The print on its sheet, over a pale field taken from its own pinks.",
    slides: [SHOP_RELEASE],
  },
  {
    id: "artist",
    label: "Featured artist",
    note: "The full profile lives on lax.art, so the link says so.",
    slides: [
      {
        id: "artist",
        time: "Featured artist",
        title: "Flora Powers",
        fact: "Contemporary painter · 4 editions in the Shop, from £42",
        primary: { label: "See the editions", href: "#editions" },
        link: { label: "Full profile on lax.art", href: "#profile" },
        credit: { text: "Flora Powers · Vessel Study", href: "#edition" },
        media: [plate("reed", "#e3e8d8", "dark", { width: 800, height: 1000 })],
      },
    ],
  },
  {
    id: "sold-out",
    label: "Sold out",
    note: "Sold out is stated, never hidden, and the button goes to what can still be bought.",
    slides: [
      {
        id: "sold-out",
        badge: "Sold out",
        time: "Edition sold out",
        title: "Reed Study",
        fact: "All 24 prints are sold. Flora Powers has three more editions, from £42.",
        primary: { label: "See available editions", href: "#editions" },
        link: { label: "Get alerts for new editions", href: "#alerts" },
        credit: { text: "Flora Powers · Reed Study · edition of 24 · sold out" },
        media: [plate("reed", "#e3e8d8", "dark", { width: 800, height: 1000 })],
      },
    ],
  },
  {
    id: "quiet",
    label: "Quiet week",
    note: "The gallery photograph is large enough to be a real cover.",
    slides: [
      {
        id: "quiet",
        time: "LAX Shop",
        title: "Limited-edition prints from our Marylebone gallery",
        fact: "Editions by 4 gallery artists, from £42 · prices include VAT",
        primary: { label: "Browse editions", href: "#editions" },
        link: { label: "See the artists", href: "#artists" },
        credit: { text: "The gallery" },
        media: [photo("gallery", "light", 0.45, { width: 3000, height: 1700 })],
      },
    ],
  },
  {
    id: "no-photo",
    label: "No photograph",
    note: "The edition has no photograph yet, so it leads as type on the paper tone.",
    slides: [
      {
        id: "no-photo",
        time: "New release · 28 Oct 2026",
        title: "Harbour at dusk (artist’s proof)",
        fact: "By Ines Calder · giclée print on archival paper, an edition of 3 · £650 with VAT",
        primary: { label: "See the edition", href: "#edition" },
        link: { label: "Browse all editions", href: "#editions" },
        media: [],
      },
    ],
  },
];

/** Behaviour scenarios that are not product states: a failing picture and a data error. */
export const COVER_BEHAVIOUR_FIXTURES: readonly CoverFixture[] = [
  {
    id: "photo-fails",
    label: "Photograph fails, plate follows",
    note: "A picture that cannot load is skipped without a message.",
    slides: [
      {
        ...LIVE,
        id: "fails",
        media: [
          {
            ...photo("estuary", "light", 0.45),
            slots: {
              default: {
                src: "/missing-cover.jpg",
                width: 3200,
                height: 1400,
                focal: { x: 0.7, y: 0.5 },
                zoom: 1,
              },
            },
          },
          plate("estuary", "#162936", "light", { width: 1500, height: 1000 }),
        ],
      },
    ],
  },
  {
    id: "all-fail",
    label: "Every picture fails, type follows",
    note: "With no source left the cover is type only.",
    slides: [
      {
        ...LIVE,
        id: "all-fail",
        media: [{ ...plate("estuary", "#162936", "light"), src: "/missing-plate.jpg" }],
      },
    ],
  },
  {
    id: "data-error",
    label: "Data error",
    note: "A neutral type cover that still leads somewhere.",
    slides: [
      {
        id: "error",
        title: "Sales can’t be shown right now",
        fact: "Please try again in a moment, or browse the sales directly.",
        primary: { label: "Browse sales", href: "#sales" },
        media: [],
      },
    ],
  },
];

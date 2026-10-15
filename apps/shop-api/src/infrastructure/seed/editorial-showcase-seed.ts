import type { Database } from "@auction/db";
import {
  shopEditorialExhibition,
  shopEditorialPage,
  shopEditorialPlacement,
  shopEditorialStory,
  shopEditorialVenue,
} from "@auction/db/schema";
import { type EditorialBlock, parseEditorialBlocks } from "@auction/shop-contracts";
import { sql } from "drizzle-orm";

const SEED_ACTOR = "seed:editorial-showcase";
const VENUE_SLUG = "lax-marylebone";
const EXHIBITION_SLUG = "showcase-new-originals";
const UPCOMING_EXHIBITION_SLUG = "showcase-form-and-fold";
const PAST_EXHIBITION_SLUG = "showcase-paper-rooms";
const STORY_SLUG = "showcase-welcome";
const GUIDE_SLUG = "showcase-collecting-guide";
/** Works and artist from `seed:catalogue`; rails skip slugs that are missing. */
const SEED_ARTWORK_SLUGS = ["quiet-orchard", "tidal-forms", "harbour-light", "marylebone-dusk"];
const SCULPTURE_ARTWORK_SLUGS = ["bronze-tide", "vessel-form-ii"];
const SEED_ARTIST_SLUGS = ["art-foundation-artist", "theo-marsh", "ines-okafor"];

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(offsetDays: number, now: Date): string {
  return new Date(now.getTime() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function blocks(value: readonly EditorialBlock[]): EditorialBlock[] {
  return parseEditorialBlocks(value);
}

const STORY_BODY = blocks([
  {
    type: "richText",
    spans: [
      { text: "lax.art is the London Art Exchange’s home for " },
      { text: "original works", marks: ["bold"] },
      { text: " — each one sold directly by our gallery team. Browse the " },
      { text: "full collection", marks: ["link"], href: "/artworks" },
      { text: " or read on for how buying works." },
    ],
  },
  { type: "heading", level: 2, text: "Gallery-led, from enquiry to hanging" },
  {
    type: "richText",
    spans: [
      {
        text: "Every artwork page has an enquiry button. A specialist replies with availability, framing and delivery options, and can arrange a private viewing in Marylebone.",
      },
    ],
  },
  {
    type: "quote",
    text: "We want collectors to meet the work before they live with it.",
    attribution: "LAX Art gallery team",
  },
  { type: "artworkRail", headline: "Available now", artworkSlugs: SEED_ARTWORK_SLUGS },
  {
    type: "faqGroup",
    items: [
      {
        question: "Can I see a work in person?",
        answer: [
          { text: "Yes. Book a private viewing from the " },
          { text: "Visit page", marks: ["link"], href: "/visit" },
          { text: "." },
        ],
      },
      {
        question: "Do you ship internationally?",
        answer: [{ text: "We ship worldwide with insured, tracked art handlers." }],
      },
    ],
  },
  { type: "artistRail", headline: "Artists in this story", artistSlugs: SEED_ARTIST_SLUGS },
  {
    type: "cta",
    title: "Talk to an advisor",
    body: "Tell us what you are looking for and we will put together a shortlist.",
    buttonLabel: "Contact the gallery",
    href: "/contact",
  },
]);

const GUIDE_BODY = blocks([
  { type: "heading", level: 2, text: "Before you buy" },
  {
    type: "cardGrid",
    items: [
      {
        title: "Ask about provenance",
        body: "Every work lists its provenance and edition details on the artwork page.",
        linkUrl: "/artworks",
      },
      {
        title: "Plan for framing",
        body: "Our team can recommend framers and hanging options for each piece.",
        linkUrl: "/contact",
      },
      {
        title: "View in person",
        body: "Private viewings are free and run Tuesday to Saturday.",
        linkUrl: "/visit",
      },
    ],
  },
]);

const EXHIBITION_BODY = blocks([
  {
    type: "richText",
    spans: [
      {
        text: "A rotating selection of new originals, hung in the Marylebone gallery and available to enquire about online.",
      },
    ],
  },
  { type: "artworkRail", headline: "Works in the show", artworkSlugs: SEED_ARTWORK_SLUGS },
]);

/** Served by `apps/art/public`; `coverMediaKey` resolves root-relative when object storage is off. */
const SEED_COVER = {
  venue: "/art/seed/signup-gallery.webp",
  current: "/art/seed/hero-layer-1.webp",
  upcoming: "/art/seed/hero-layer-3.webp",
  past: "/art/seed/original-3.webp",
  story: "/art/seed/hero-layer-2.webp",
  guide: "/art/seed/original-2.webp",
} as const;

const OPENING_HOURS = [
  { label: "Tue – Sat", hours: "10:00 – 18:00" },
  { label: "Sun", hours: "12:00 – 17:00" },
  { label: "Mon", hours: "Closed" },
];

async function upsertVenue(db: Database, now: Date): Promise<string | undefined> {
  const [row] = await db
    .insert(shopEditorialVenue)
    .values({
      slug: VENUE_SLUG,
      status: "published",
      publishedAt: now,
      updatedBy: SEED_ACTOR,
      name: "LAX Marylebone",
      address: "12 Example Mews, London",
      postcode: "W1U 1AA",
      openingHours: OPENING_HOURS,
      phone: "+44 20 0000 0000",
      email: "gallery@lax.art",
      mapUrl: "https://maps.google.com/?q=Marylebone+London",
      coverMediaKey: SEED_COVER.venue,
      bodyBlocks: [],
    })
    .onConflictDoUpdate({
      target: shopEditorialVenue.slug,
      set: {
        status: "published",
        publishedAt: now,
        updatedBy: SEED_ACTOR,
        openingHours: OPENING_HOURS,
        coverMediaKey: SEED_COVER.venue,
        updatedAt: now,
      },
    })
    .returning({ id: shopEditorialVenue.id });
  return row?.id;
}

type SeedExhibition = {
  slug: string;
  title: string;
  summary: string;
  startsInDays: number;
  endsInDays: number;
  featured: boolean;
  cover: string;
  body: EditorialBlock[];
};

const EXHIBITIONS: readonly SeedExhibition[] = [
  {
    slug: EXHIBITION_SLUG,
    title: "New Originals",
    summary: "Fresh work from the LAX roster, in the gallery and online.",
    startsInDays: -14,
    endsInDays: 60,
    featured: true,
    cover: SEED_COVER.current,
    body: EXHIBITION_BODY,
  },
  {
    slug: UPCOMING_EXHIBITION_SLUG,
    title: "Form & Fold",
    summary: "Sculpture and ceramics by Theo Marsh, opening next month.",
    startsInDays: 30,
    endsInDays: 90,
    featured: true,
    cover: SEED_COVER.upcoming,
    body: blocks([
      {
        type: "richText",
        spans: [{ text: "Bronze and stoneware forms that borrow their rhythm from the sea." }],
      },
      { type: "artworkRail", headline: "Preview the works", artworkSlugs: SCULPTURE_ARTWORK_SLUGS },
    ]),
  },
  {
    slug: PAST_EXHIBITION_SLUG,
    title: "Paper Rooms",
    summary: "Drawings, etchings and works on paper from the gallery archive.",
    startsInDays: -200,
    endsInDays: -120,
    featured: false,
    cover: SEED_COVER.past,
    body: blocks([
      {
        type: "richText",
        spans: [{ text: "A look back at the gallery's spring show of works on paper." }],
      },
    ]),
  },
];

async function upsertExhibition(
  db: Database,
  exhibition: SeedExhibition,
  venueId: string | undefined,
  now: Date,
): Promise<string | undefined> {
  const values = {
    status: "published" as const,
    publishedAt: now,
    updatedBy: SEED_ACTOR,
    kind: "exhibition" as const,
    venueId: venueId ?? null,
    title: exhibition.title,
    summary: exhibition.summary,
    startsOn: isoDate(exhibition.startsInDays, now),
    endsOn: isoDate(exhibition.endsInDays, now),
    featured: exhibition.featured,
    coverMediaKey: exhibition.cover,
    bodyBlocks: exhibition.body,
  };
  const [row] = await db
    .insert(shopEditorialExhibition)
    .values({ slug: exhibition.slug, ...values })
    .onConflictDoUpdate({
      target: shopEditorialExhibition.slug,
      set: { ...values, updatedAt: now },
    })
    .returning({ id: shopEditorialExhibition.id });
  return row?.id;
}

type SeedPage = { slug: string; title: string; body: EditorialBlock[] };

function prose(text: string): EditorialBlock {
  return { type: "richText", spans: [{ text }] };
}

/** Guide, legal and Collector Hub pages; slugs match Art's canonical page routes. */
const PAGES: readonly SeedPage[] = [
  {
    slug: "how-to-buy",
    title: "How to buy",
    body: blocks([
      prose(
        "Every original on lax.art is sold directly by the London Art Exchange gallery team, by enquiry and invoice.",
      ),
      { type: "heading", level: 2, text: "Three steps" },
      {
        type: "cardGrid",
        items: [
          {
            title: "Enquire",
            body: "Use the enquiry button on any artwork page. A specialist replies within one working day.",
            linkUrl: "/artworks",
          },
          {
            title: "View",
            body: "See the work in person at the gallery, or ask for more photographs and a condition report.",
            linkUrl: "/visit",
          },
          {
            title: "Collect",
            body: "Pay by invoice and we arrange insured delivery and hanging advice.",
            linkUrl: "/contact",
          },
        ],
      },
    ]),
  },
  {
    slug: "how-to-sell",
    title: "How to sell",
    body: blocks([
      prose(
        "We consign selected originals from collectors and estates. Tell us about the work and a specialist will advise on value and the best route to sale.",
      ),
      {
        type: "faqGroup",
        items: [
          {
            question: "What do you need from me?",
            answer: [
              { text: "Photographs, dimensions, and any provenance or certificates you hold." },
            ],
          },
          {
            question: "Is there a fee to get a valuation?",
            answer: [{ text: "No. Initial advice and valuations are free." }],
          },
        ],
      },
    ]),
  },
  {
    slug: "101-guide",
    title: "Collecting 101",
    body: GUIDE_BODY,
  },
  {
    slug: "art-advisory",
    title: "Art advisory",
    body: blocks([
      prose(
        "Our advisors help you build a collection with intent, from a first original to a curated scheme for a home or office.",
      ),
    ]),
  },
  {
    slug: "privacy",
    title: "Privacy notice",
    body: blocks([
      prose(
        "This placeholder privacy notice is seeded for local development. Replace it in the admin editorial workspace before launch.",
      ),
    ]),
  },
  {
    slug: "terms",
    title: "Terms of use",
    body: blocks([
      prose(
        "These placeholder terms are seeded for local development. Replace them in the admin editorial workspace before launch.",
      ),
    ]),
  },
  ...(
    [
      ["cookies", "Cookie policy"],
      ["shipping", "Shipping and delivery"],
      ["returns", "Returns policy"],
      ["accessibility", "Accessibility statement"],
      ["modern-slavery", "Modern slavery statement"],
    ] as const
  ).map(([slug, title]) => ({
    slug,
    title,
    body: blocks([
      prose(
        `This placeholder ${title.toLowerCase()} is seeded for local development. Replace it in the admin editorial workspace before launch.`,
      ),
    ]),
  })),
];

async function upsertPage(db: Database, page: SeedPage, now: Date): Promise<string | undefined> {
  const values = {
    status: "published" as const,
    publishedAt: now,
    updatedBy: SEED_ACTOR,
    title: page.title,
    bodyBlocks: page.body,
  };
  const [row] = await db
    .insert(shopEditorialPage)
    .values({ slug: page.slug, ...values })
    .onConflictDoUpdate({ target: shopEditorialPage.slug, set: { ...values, updatedAt: now } })
    .returning({ id: shopEditorialPage.id });
  return row?.id;
}

async function upsertStory(
  db: Database,
  story: {
    slug: string;
    kind: "article" | "guide";
    title: string;
    standfirst: string;
    cover: string;
    body: EditorialBlock[];
  },
  now: Date,
): Promise<string | undefined> {
  const values = {
    status: "published" as const,
    publishedAt: now,
    updatedBy: SEED_ACTOR,
    kind: story.kind,
    title: story.title,
    standfirst: story.standfirst,
    featured: true,
    coverMediaKey: story.cover,
    bodyBlocks: story.body,
  };
  const [row] = await db
    .insert(shopEditorialStory)
    .values({ slug: story.slug, ...values })
    .onConflictDoUpdate({ target: shopEditorialStory.slug, set: { ...values, updatedAt: now } })
    .returning({ id: shopEditorialStory.id });
  return row?.id;
}

type SeedPlacement = typeof shopEditorialPlacement.$inferInsert;

/** Idempotent venue, exhibitions, stories, pages and placements for local lax.art demos. */
export async function seedEditorialShowcase(db: Database): Promise<void> {
  const now = new Date();
  const venueId = await upsertVenue(db, now);
  const exhibitionIds = new Map<string, string | undefined>();
  for (const exhibition of EXHIBITIONS) {
    exhibitionIds.set(exhibition.slug, await upsertExhibition(db, exhibition, venueId, now));
  }
  const pageIds = new Map<string, string | undefined>();
  for (const page of PAGES) {
    pageIds.set(page.slug, await upsertPage(db, page, now));
  }
  const exhibitionId = exhibitionIds.get(EXHIBITION_SLUG);
  const upcomingId = exhibitionIds.get(UPCOMING_EXHIBITION_SLUG);
  const collectingGuideId = pageIds.get("101-guide");
  const advisoryId = pageIds.get("art-advisory");
  const storyId = await upsertStory(
    db,
    {
      slug: STORY_SLUG,
      kind: "article",
      title: "Welcome to lax.art",
      standfirst: "Gallery-led originals, sold directly by the London Art Exchange.",
      cover: SEED_COVER.story,
      body: STORY_BODY,
    },
    now,
  );
  const guideId = await upsertStory(
    db,
    {
      slug: GUIDE_SLUG,
      kind: "guide",
      title: "A first-time collector’s guide",
      standfirst: "Three things to check before buying an original.",
      cover: SEED_COVER.guide,
      body: GUIDE_BODY,
    },
    now,
  );
  if (!exhibitionId || !upcomingId || !storyId || !guideId || !collectingGuideId || !advisoryId) {
    return;
  }

  const placements: SeedPlacement[] = [
    {
      slot: "home_hero",
      position: 0,
      refKind: "exhibition",
      refId: exhibitionId,
      headline: "New Originals — now on in Marylebone",
      linkUrl: `/exhibitions/${EXHIBITION_SLUG}`,
    },
    {
      slot: "home_whats_on",
      position: 0,
      refKind: "exhibition",
      refId: exhibitionId,
      headline: "New Originals",
      linkUrl: null,
    },
    {
      slot: "home_whats_on",
      position: 1,
      refKind: "exhibition",
      refId: upcomingId,
      headline: "Form & Fold",
      linkUrl: null,
    },
    {
      slot: "home_stories",
      position: 0,
      refKind: "story",
      refId: storyId,
      headline: "Welcome to lax.art",
      linkUrl: null,
    },
    {
      slot: "home_guide",
      position: 0,
      refKind: "story",
      refId: guideId,
      headline: "A first-time collector’s guide",
      linkUrl: null,
    },
    {
      slot: "art_hub_spotlight",
      position: 0,
      refKind: "exhibition",
      refId: exhibitionId,
      headline: "New Originals",
      linkUrl: null,
    },
    {
      slot: "collector_hub_card",
      position: 0,
      refKind: "page",
      refId: collectingGuideId,
      headline: "Collecting 101",
      linkUrl: null,
    },
    {
      slot: "collector_hub_card",
      position: 1,
      refKind: "page",
      refId: advisoryId,
      headline: "Art advisory",
      linkUrl: null,
    },
    {
      slot: "collector_hub_card",
      position: 2,
      refKind: "story",
      refId: guideId,
      headline: "A first-time collector’s guide",
      linkUrl: null,
    },
  ];

  for (const placement of placements) {
    await db
      .insert(shopEditorialPlacement)
      .values({ ...placement, publishedAt: now })
      .onConflictDoUpdate({
        target: [shopEditorialPlacement.slot, shopEditorialPlacement.position],
        set: {
          refKind: sql`excluded.ref_kind`,
          refId: sql`excluded.ref_id`,
          headline: sql`excluded.headline`,
          linkUrl: sql`excluded.link_url`,
          publishedAt: now,
          updatedAt: now,
        },
      });
  }
}

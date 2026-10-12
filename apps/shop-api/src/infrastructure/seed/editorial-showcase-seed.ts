import type { Database } from "@auction/db";
import {
  shopEditorialExhibition,
  shopEditorialPlacement,
  shopEditorialStory,
  shopEditorialVenue,
} from "@auction/db/schema";
import { type EditorialBlock, parseEditorialBlocks } from "@auction/shop-contracts";
import { sql } from "drizzle-orm";

const SEED_ACTOR = "seed:editorial-showcase";
const VENUE_SLUG = "lax-marylebone";
const EXHIBITION_SLUG = "showcase-new-originals";
const STORY_SLUG = "showcase-welcome";
const GUIDE_SLUG = "showcase-collecting-guide";
/** Works and artist from `seed:catalogue`; rails skip slugs that are missing. */
const SEED_ARTWORK_SLUGS = ["quiet-orchard", "tidal-forms"];
const SEED_ARTIST_SLUGS = ["art-foundation-artist"];

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
      bodyBlocks: [],
    })
    .onConflictDoUpdate({
      target: shopEditorialVenue.slug,
      set: {
        status: "published",
        publishedAt: now,
        updatedBy: SEED_ACTOR,
        openingHours: OPENING_HOURS,
        updatedAt: now,
      },
    })
    .returning({ id: shopEditorialVenue.id });
  return row?.id;
}

async function upsertExhibition(
  db: Database,
  venueId: string | undefined,
  now: Date,
): Promise<string | undefined> {
  const values = {
    status: "published" as const,
    publishedAt: now,
    updatedBy: SEED_ACTOR,
    kind: "exhibition" as const,
    venueId: venueId ?? null,
    title: "New Originals",
    summary: "Fresh work from the LAX roster, in the gallery and online.",
    startsOn: isoDate(-14, now),
    endsOn: isoDate(60, now),
    featured: true,
    bodyBlocks: EXHIBITION_BODY,
  };
  const [row] = await db
    .insert(shopEditorialExhibition)
    .values({ slug: EXHIBITION_SLUG, ...values })
    .onConflictDoUpdate({
      target: shopEditorialExhibition.slug,
      set: { ...values, updatedAt: now },
    })
    .returning({ id: shopEditorialExhibition.id });
  return row?.id;
}

async function upsertStory(
  db: Database,
  story: {
    slug: string;
    kind: "article" | "guide";
    title: string;
    standfirst: string;
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

/** Idempotent venue, exhibition, stories and home/hub placements for local lax.art demos. */
export async function seedEditorialShowcase(db: Database): Promise<void> {
  const now = new Date();
  const venueId = await upsertVenue(db, now);
  const exhibitionId = await upsertExhibition(db, venueId, now);
  const storyId = await upsertStory(
    db,
    {
      slug: STORY_SLUG,
      kind: "article",
      title: "Welcome to lax.art",
      standfirst: "Gallery-led originals, sold directly by the London Art Exchange.",
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
      body: GUIDE_BODY,
    },
    now,
  );
  if (!exhibitionId || !storyId || !guideId) return;

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

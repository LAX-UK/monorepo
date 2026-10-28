import { GALLERY_CONTACT } from "@auction/branding";
import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopEditorialExhibition,
  shopEditorialExhibitionArtist,
  shopEditorialExhibitionArtwork,
  shopEditorialPage,
  shopEditorialPlacement,
  shopEditorialStory,
  shopEditorialStoryArtist,
  shopEditorialStoryArtwork,
  shopEditorialStoryExhibition,
  shopEditorialVenue,
} from "@auction/db/schema";
import {
  type EditorialBlock,
  type EditorialStoryCategory,
  type EditorialStoryKind,
  estimateEditorialReadMinutes,
  parseEditorialBlocks,
} from "@auction/shop-contracts";
import { eq, inArray, sql } from "drizzle-orm";
import { seedHelpCentre } from "./help-centre-seed.js";

const SEED_ACTOR = "seed:editorial-showcase";
const VENUE_SLUG = "lax-marylebone";
const EXHIBITION_SLUG = "showcase-new-originals";
const UPCOMING_EXHIBITION_SLUG = "showcase-form-and-fold";
const PAST_EXHIBITION_SLUG = "showcase-paper-rooms";
const STORY_SLUG = "showcase-welcome";
const GUIDE_SLUG = "showcase-collecting-guide";
const PODCAST_SLUG = "showcase-podcast-studio-light";
const PRESS_SLUG = "showcase-press-new-originals";
const FILM_SLUG = "showcase-film-inside-the-studio";
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
      { text: ", each one sold directly by our gallery team. Browse the " },
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
    attribution: "The gallery team",
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

/** Card address lines and map pin for the seeded gallery. */
const VENUE_LOCATION = {
  streetLine: GALLERY_CONTACT.streetLine,
  city: GALLERY_CONTACT.city,
  latitude: 51.520_1,
  longitude: -0.143_6,
};

/** Contact details shown on the venue page and the gallery card, from the shared gallery source. */
const VENUE_DETAILS = {
  address: GALLERY_CONTACT.address,
  postcode: GALLERY_CONTACT.postcode,
  phone: GALLERY_CONTACT.phone,
  email: GALLERY_CONTACT.email,
  mapUrl: `https://maps.google.com/?q=${encodeURIComponent(`${GALLERY_CONTACT.address} ${GALLERY_CONTACT.postcode}`)}`,
};

async function upsertVenue(db: Database, now: Date): Promise<string | undefined> {
  const [row] = await db
    .insert(shopEditorialVenue)
    .values({
      slug: VENUE_SLUG,
      status: "published",
      publishedAt: now,
      updatedBy: SEED_ACTOR,
      name: GALLERY_CONTACT.name,
      address: VENUE_DETAILS.address,
      postcode: VENUE_DETAILS.postcode,
      ...VENUE_LOCATION,
      openingHours: OPENING_HOURS,
      phone: VENUE_DETAILS.phone,
      email: VENUE_DETAILS.email,
      mapUrl: VENUE_DETAILS.mapUrl,
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
        ...VENUE_DETAILS,
        ...VENUE_LOCATION,
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
  subtitle?: string;
  contact?: { name: string; role: string; email: string; phone: string };
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
    subtitle: "Selling exhibition",
    contact: {
      name: "Elena Wendy",
      role: "Exhibition specialist",
      email: GALLERY_CONTACT.email,
      phone: GALLERY_CONTACT.phone,
    },
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
    subtitle: exhibition.subtitle ?? null,
    contactName: exhibition.contact?.name ?? null,
    contactRole: exhibition.contact?.role ?? null,
    contactEmail: exhibition.contact?.email ?? null,
    contactPhone: exhibition.contact?.phone ?? null,
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

type SeedStory = {
  slug: string;
  kind: EditorialStoryKind;
  title: string;
  standfirst: string;
  cover: string;
  body: EditorialBlock[];
  category?: EditorialStoryCategory;
  authorName?: string;
  series?: string;
  episodeNumber?: number;
  audioUrl?: string;
  durationSeconds?: number;
  publicationName?: string;
  externalUrl?: string;
  videoUrl?: string;
};

async function upsertStory(db: Database, story: SeedStory, now: Date): Promise<string | undefined> {
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
    category: story.category ?? null,
    authorName: story.authorName ?? null,
    readMinutesEstimate: estimateEditorialReadMinutes(story.body),
    series: story.series ?? null,
    episodeNumber: story.episodeNumber ?? null,
    audioUrl: story.audioUrl ?? null,
    durationSeconds: story.durationSeconds ?? null,
    publicationName: story.publicationName ?? null,
    externalUrl: story.externalUrl ?? null,
    videoUrl: story.videoUrl ?? null,
  };
  const [row] = await db
    .insert(shopEditorialStory)
    .values({ slug: story.slug, ...values })
    .onConflictDoUpdate({ target: shopEditorialStory.slug, set: { ...values, updatedAt: now } })
    .returning({ id: shopEditorialStory.id });
  return row?.id;
}

type SeedPlacement = typeof shopEditorialPlacement.$inferInsert;

async function idsBySlug(
  db: Database,
  table: typeof shopArtwork | typeof shopArtist,
  slugs: readonly string[],
): Promise<string[]> {
  const rows = await db
    .select({ id: table.id, slug: table.slug })
    .from(table)
    .where(inArray(table.slug, [...slugs]));
  const idBySlug = new Map(rows.map((row) => [row.slug, row.id]));
  return slugs.flatMap((slug) => idBySlug.get(slug) ?? []);
}

/** A show features the artists whose works hang in it. */
async function artistIdsForWorks(db: Database, artworkIds: string[]): Promise<string[]> {
  if (artworkIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ artistId: shopArtwork.artistId })
    .from(shopArtwork)
    .where(inArray(shopArtwork.id, artworkIds));
  return rows.map((row) => row.artistId);
}

/**
 * Replaces the showcase's curated works, artists and cross-links so the exhibition and story
 * pages have related content locally. Works and artists missing from `seed:catalogue` are skipped.
 */
async function seedEditorialJoins(
  db: Database,
  ids: { exhibitionId: string; upcomingId: string; storyId: string },
): Promise<void> {
  const [currentWorks, upcomingWorks, storyArtists] = await Promise.all([
    idsBySlug(db, shopArtwork, SEED_ARTWORK_SLUGS),
    idsBySlug(db, shopArtwork, SCULPTURE_ARTWORK_SLUGS),
    idsBySlug(db, shopArtist, SEED_ARTIST_SLUGS),
  ]);
  const [currentArtists, upcomingArtists] = await Promise.all([
    artistIdsForWorks(db, currentWorks),
    artistIdsForWorks(db, upcomingWorks),
  ]);
  const exhibitionIds = [ids.exhibitionId, ids.upcomingId];
  await db.transaction(async (tx) => {
    await tx
      .delete(shopEditorialExhibitionArtwork)
      .where(inArray(shopEditorialExhibitionArtwork.exhibitionId, exhibitionIds));
    await tx
      .delete(shopEditorialExhibitionArtist)
      .where(inArray(shopEditorialExhibitionArtist.exhibitionId, exhibitionIds));
    await tx
      .delete(shopEditorialStoryArtist)
      .where(eq(shopEditorialStoryArtist.storyId, ids.storyId));
    await tx
      .delete(shopEditorialStoryArtwork)
      .where(eq(shopEditorialStoryArtwork.storyId, ids.storyId));
    await tx
      .delete(shopEditorialStoryExhibition)
      .where(eq(shopEditorialStoryExhibition.storyId, ids.storyId));

    const exhibitionWorks = [
      ...currentWorks.map((artworkId, position) => ({
        exhibitionId: ids.exhibitionId,
        artworkId,
        position,
      })),
      ...upcomingWorks.map((artworkId, position) => ({
        exhibitionId: ids.upcomingId,
        artworkId,
        position,
      })),
    ];
    const exhibitionArtists = [
      ...currentArtists.map((artistId, position) => ({
        exhibitionId: ids.exhibitionId,
        artistId,
        position,
      })),
      ...upcomingArtists.map((artistId, position) => ({
        exhibitionId: ids.upcomingId,
        artistId,
        position,
      })),
    ];
    if (exhibitionWorks.length > 0) {
      await tx.insert(shopEditorialExhibitionArtwork).values(exhibitionWorks);
    }
    if (exhibitionArtists.length > 0) {
      await tx.insert(shopEditorialExhibitionArtist).values(exhibitionArtists);
    }
    if (storyArtists.length > 0) {
      await tx
        .insert(shopEditorialStoryArtist)
        .values(
          storyArtists.map((artistId, position) => ({ storyId: ids.storyId, artistId, position })),
        );
    }
    if (currentWorks.length > 0) {
      await tx
        .insert(shopEditorialStoryArtwork)
        .values(
          currentWorks
            .slice(0, 2)
            .map((artworkId, position) => ({ storyId: ids.storyId, artworkId, position })),
        );
    }
    await tx
      .insert(shopEditorialStoryExhibition)
      .values(exhibitionIds.map((exhibitionId) => ({ storyId: ids.storyId, exhibitionId })));
  });
}

/** The old promo copy for Shop and Bid; the product doors carry their own copy now. */
const RETIRED_PROMO_SLOTS = ["home_promo_bid", "home_promo_shop"] as const;

async function retireProductPromoPlacements(db: Database): Promise<void> {
  await db
    .delete(shopEditorialPlacement)
    .where(inArray(shopEditorialPlacement.slot, [...RETIRED_PROMO_SLOTS]));
}

/** Idempotent venue, exhibitions, stories, pages, placements, joins and Help centre for local lax.art demos. */
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
      authorName: "Clara Hutchins",
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
      series: "Collecting guide",
    },
    now,
  );
  const podcastId = await upsertStory(
    db,
    {
      slug: PODCAST_SLUG,
      kind: "podcast",
      title: "Studio light with Ines Okafor",
      standfirst: "How a painter chases the last hour of daylight across a London winter.",
      cover: SEED_COVER.story,
      body: blocks([prose("Episode notes: studio rituals, north light and the first sale.")]),
      series: "In the studio",
      episodeNumber: 4,
      durationSeconds: 46 * 60 + 18,
      audioUrl: "https://media.lax.art/podcast/studio-light.mp3",
    },
    now,
  );
  const pressId = await upsertStory(
    db,
    {
      slug: PRESS_SLUG,
      kind: "press",
      title: "New Originals brings young painters to Marylebone",
      standfirst: "A review of the gallery's autumn selling show.",
      cover: SEED_COVER.current,
      body: [],
      publicationName: "Art Plugged",
      externalUrl: "https://example.com/art-plugged/new-originals",
    },
    now,
  );
  const filmId = await upsertStory(
    db,
    {
      slug: FILM_SLUG,
      kind: "film",
      title: "Inside the studio with Theo Marsh",
      standfirst: "A week in the studio as bronze and stoneware forms take shape for Form & Fold.",
      cover: SEED_COVER.upcoming,
      body: blocks([prose("A short film shot over a week in the studio, from clay to cast.")]),
      durationSeconds: 4 * 60 + 12,
      videoUrl: "https://media.lax.art/film/inside-the-studio",
    },
    now,
  );
  if (
    !exhibitionId ||
    !upcomingId ||
    !storyId ||
    !guideId ||
    !podcastId ||
    !pressId ||
    !filmId ||
    !collectingGuideId ||
    !advisoryId
  ) {
    return;
  }
  await seedEditorialJoins(db, { exhibitionId, upcomingId, storyId });

  const placements: SeedPlacement[] = [
    {
      slot: "home_hero",
      position: 0,
      refKind: "exhibition",
      refId: exhibitionId,
      headline: "New Originals, now on in Marylebone",
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
      body: "Start with what you respond to, then learn how to read a work and its edition.",
      ctaLabel: "Learn more",
      linkUrl: null,
    },
    {
      slot: "collector_hub_card",
      position: 1,
      refKind: "page",
      refId: advisoryId,
      headline: "Art advisory",
      body: "Advisors who build a collection around your space, budget and taste.",
      ctaLabel: "Learn more",
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
    {
      slot: "art_hub_podcast",
      position: 0,
      refKind: "story",
      refId: podcastId,
      headline: "LAX's Podcast",
      linkUrl: null,
    },
    {
      slot: "art_hub_films",
      position: 0,
      refKind: "story",
      refId: filmId,
      headline: "Films",
      linkUrl: null,
    },
    {
      slot: "art_hub_press",
      position: 0,
      refKind: "story",
      refId: pressId,
      headline: "Press",
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
          body: sql`excluded.body`,
          ctaLabel: sql`excluded.cta_label`,
          publishedAt: now,
          updatedAt: now,
        },
      });
  }

  await retireProductPromoPlacements(db);
  await seedHelpCentre(db);
}

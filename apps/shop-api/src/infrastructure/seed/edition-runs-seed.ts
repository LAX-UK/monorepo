import type { Database } from "@auction/db";
import { shopArtwork, shopEdition } from "@auction/db/schema";
import type { EditionFacts, EditionRunSpec, ProofsKept } from "@auction/shop-domain";
import { and, eq, isNotNull } from "drizzle-orm";
import type { ImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";
import { createDrizzleEditionFactsRepository } from "../drizzle-edition-facts.repository.js";
import { createDrizzleEditionRunRepository } from "../drizzle-edition-run.repository.js";
import { insertEditionRun } from "../insert-planned-editions.js";
import type { GrantSaleAuthorityFn } from "./edition-stock-seed.js";
import { grantSeedAuthorityForArtwork } from "./edition-stock-seed.js";

const SEED_CONFIRMED_BY = "seed:catalogue";
const SEED_CONFIRMED_AT = new Date("2026-10-28T09:00:00Z");

const NO_PROOFS: ProofsKept = { ap: 0, pp: 0, hc: 0, bat: 0 };

const confirmed = (facts: Omit<EditionFacts, "confirmed">): EditionFacts => ({
  ...facts,
  confirmed: { by: SEED_CONFIRMED_BY, at: SEED_CONFIRMED_AT },
});

const handSignedInPencil = {
  kind: "hand_signed",
  medium: "pencil",
  place: "front_lower_margin",
} as const;

const artistPaperWithPrint = {
  kind: "included",
  issuer: "artist",
  form: "paper",
  arrives: { kind: "with_print" },
  numberedToMatch: true,
} as const;

const UNSIGNED_UNNUMBERED = confirmed({
  numbering: "none",
  signature: { kind: "unsigned" },
  certificate: { kind: "none" },
});

/** Confirmed facts for runs the foundation catalogue already creates. */
const FACTS_FOR_EXISTING: ReadonlyArray<{ slug: string; facts: EditionFacts }> = [
  {
    slug: "harbor-print",
    facts: confirmed({
      numbering: "on_print",
      signature: handSignedInPencil,
      certificate: artistPaperWithPrint,
    }),
  },
  {
    slug: "vessel-study",
    facts: confirmed({
      numbering: "on_certificate",
      signature: { kind: "plate_signed" },
      certificate: {
        kind: "included",
        issuer: "lax",
        form: "digital",
        arrives: { kind: "with_print" },
        numberedToMatch: true,
      },
    }),
  },
  { slug: "reed-study", facts: UNSIGNED_UNNUMBERED },
  {
    slug: "acceptance-stripe-print",
    facts: confirmed({
      numbering: "on_print",
      signature: { kind: "hand_signed", medium: "ink", place: "back" },
      certificate: { kind: "none" },
    }),
  },
];

type RunFixture = {
  slug: string;
  title: string;
  description: string;
  size: string;
  printPricePence: number;
  rarity: "limited_edition" | "open_edition";
  run: EditionRunSpec;
  proofsKept?: ProofsKept;
  facts: EditionFacts;
  /** How an open or proof run is put on sale: batches to add, in order. */
  batches?: ReadonlyArray<{
    artistCount: number;
    laxCount: number;
    custodyStatus: "unprinted" | "stored";
    storageLocation?: string;
  }>;
};

const ARTIST = {
  artistSlug: "edition-runs-artist",
  artistDisplayName: "Ines Calder",
  artistDiscipline: "Printmaker",
} as const;

const HARBOUR_SLUG = "harbour-at-dusk";

/**
 * Runs beyond the LAX standard one, so test shows custom, open, proof and companion listings.
 * The proof and the companion link to Harbour at dusk, which must be created first.
 */
const FIXTURES: readonly RunFixture[] = [
  {
    slug: HARBOUR_SLUG,
    title: "Harbour at dusk",
    description: "Fishing boats at rest as the light goes, printed from the artist's original.",
    size: "60 × 45 cm",
    printPricePence: 42_000,
    rarity: "limited_edition",
    run: { type: "lax_standard" },
    proofsKept: { ap: 3, pp: 0, hc: 0, bat: 1 },
    facts: confirmed({
      numbering: "on_print",
      signature: handSignedInPencil,
      certificate: artistPaperWithPrint,
    }),
  },
  {
    slug: "composition-1964",
    title: "Composition 1964",
    description: "A posthumous edition from the artist's estate, stamped rather than signed.",
    size: "70 × 50 cm",
    printPricePence: 36_000,
    rarity: "limited_edition",
    run: {
      type: "custom_limited",
      size: 40,
      allocation: { buyer: 0, artist: 30, lax: 10 },
      linkedToOriginal: false,
    },
    facts: confirmed({
      numbering: "on_print",
      signature: { kind: "estate_stamped" },
      certificate: {
        kind: "included",
        issuer: "publisher",
        form: "paper",
        arrives: { kind: "separately", withinWeeks: 4 },
        numberedToMatch: true,
      },
    }),
  },
  {
    slug: "shoreline-estate",
    title: "Shoreline, estate edition",
    description: "A small estate edition, signed by the estate on the back of each print.",
    size: "50 × 40 cm",
    printPricePence: 28_000,
    rarity: "limited_edition",
    run: {
      type: "custom_limited",
      size: 12,
      allocation: { buyer: 0, artist: 8, lax: 4 },
      linkedToOriginal: false,
    },
    facts: confirmed({
      numbering: "on_print",
      signature: { kind: "estate_signed", place: "back" },
      certificate: {
        kind: "included",
        issuer: "publisher",
        form: "paper",
        arrives: { kind: "with_print" },
        numberedToMatch: true,
      },
    }),
  },
  {
    slug: "night-garden",
    title: "Night garden",
    description: "An open edition print with no limit on the number made.",
    size: "40 × 30 cm",
    printPricePence: 9_500,
    rarity: "open_edition",
    run: { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } },
    facts: UNSIGNED_UNNUMBERED,
    batches: [
      {
        artistCount: 10,
        laxCount: 10,
        custodyStatus: "stored",
        storageLocation: "Plan chest B, drawer 3",
      },
      { artistCount: 5, laxCount: 5, custodyStatus: "unprinted" },
    ],
  },
  {
    slug: "harbour-at-dusk-artists-proof",
    title: "Harbour at dusk (artist's proof)",
    description: "Three artist's proofs of Harbour at dusk, kept outside the edition.",
    size: "60 × 45 cm",
    printPricePence: 65_000,
    rarity: "limited_edition",
    run: {
      type: "proof",
      proofType: "ap",
      size: 3,
      owner: "artist",
      mainRunId: "",
      proofsKeptOnMain: 3,
    },
    facts: confirmed({
      numbering: "on_print",
      signature: handSignedInPencil,
      certificate: artistPaperWithPrint,
    }),
  },
  {
    slug: "harbour-at-dusk-unsigned",
    title: "Harbour at dusk, unsigned",
    description: "The same image as an unsigned open edition.",
    size: "60 × 45 cm",
    printPricePence: 9_500,
    rarity: "open_edition",
    run: {
      type: "companion",
      mainRunId: "",
      run: { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } },
    },
    facts: UNSIGNED_UNNUMBERED,
    batches: [{ artistCount: 5, laxCount: 5, custodyStatus: "unprinted" }],
  },
];

async function authoriseAllOwned(db: Database, artworkId: string): Promise<void> {
  await db
    .update(shopEdition)
    .set({ listingStatus: "authorised", saleAuthorisedAt: new Date() })
    .where(
      and(
        eq(shopEdition.artworkId, artworkId),
        eq(shopEdition.listingStatus, "not_authorised"),
        isNotNull(shopEdition.ownerPartyId),
      ),
    );
}

/** Gives each print in storage the short code printed on its stock label, such as NG0001. */
async function labelStoredPrints(db: Database, artworkId: string, slug: string): Promise<void> {
  const prefix = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  const stored = await db
    .select({ id: shopEdition.id, stockRef: shopEdition.stockRef })
    .from(shopEdition)
    .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.custodyStatus, "stored")));
  for (const print of stored) {
    await db
      .update(shopEdition)
      .set({ labelCode: `${prefix}${String(print.stockRef).padStart(4, "0")}` })
      .where(eq(shopEdition.id, print.id));
  }
}

/**
 * Confirms the facts of the demo runs and adds custom, open, proof and companion runs. Every
 * step skips what is already there, so it is safe to run again.
 */
export async function seedEditionRuns(
  importArtwork: ImportArtworkHandler,
  db: Database,
  grantSaleAuthority?: GrantSaleAuthorityFn,
): Promise<void> {
  const runs = createDrizzleEditionRunRepository(db);
  const facts = createDrizzleEditionFactsRepository(db);

  const idOfSlug = async (slug: string): Promise<string | null> => {
    const [row] = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.slug, slug))
      .limit(1);
    return row?.id ?? null;
  };

  for (const { slug, facts: value } of FACTS_FOR_EXISTING) {
    const artworkId = await idOfSlug(slug);
    if (artworkId && !(await facts.getFacts(artworkId))) await facts.saveFacts(artworkId, value);
  }

  const mainRunId = new Map<string, string>();
  for (const fixture of FIXTURES) {
    const { artworkId, created } = await importArtwork({
      importKey: `seed:shop:edition-run:${fixture.slug}`,
      publishOnCreate: true,
      slug: fixture.slug,
      title: fixture.title,
      description: fixture.description,
      primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
      dimensions: fixture.size,
      medium: "Giclée print on archival paper",
      yearCreated: 2024,
      saleState: "for_sale",
      ...ARTIST,
      eligibleForEditionAllocation: true,
      printPricePence: fixture.printPricePence,
      objectType: "print",
      rarity: fixture.rarity,
    });
    mainRunId.set(fixture.slug, artworkId);
    if (!created) continue;

    const spec: EditionRunSpec =
      fixture.run.type === "proof" || fixture.run.type === "companion"
        ? { ...fixture.run, mainRunId: mainRunId.get(HARBOUR_SLUG) ?? "" }
        : fixture.run;
    if (spec.type !== "lax_standard") {
      // The import made the LAX standard run; none of its prints has been offered or sold yet.
      await db.delete(shopEdition).where(eq(shopEdition.artworkId, artworkId));
      const [{ artistId } = { artistId: "" }] = await db
        .select({ artistId: shopArtwork.artistId })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, artworkId));
      await insertEditionRun(db, { artworkId, artistId, run: spec });
    }
    await runs.saveRun(artworkId, { spec, proofsKept: fixture.proofsKept ?? NO_PROOFS });

    for (const batch of fixture.batches ?? []) {
      await runs.addStockBatch({ artworkId, ...batch, addedBySubjectId: SEED_CONFIRMED_BY });
    }
    await labelStoredPrints(db, artworkId, fixture.slug);
    if (spec.type === "lax_standard" || spec.type === "custom_limited") {
      if (grantSaleAuthority) {
        await grantSeedAuthorityForArtwork(db, grantSaleAuthority, artworkId);
      }
    } else {
      await authoriseAllOwned(db, artworkId);
    }
  }

  for (const fixture of FIXTURES) {
    const artworkId = mainRunId.get(fixture.slug);
    if (artworkId && !(await facts.getFacts(artworkId)))
      await facts.saveFacts(artworkId, fixture.facts);
  }
}

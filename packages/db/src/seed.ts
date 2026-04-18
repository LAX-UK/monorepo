/**
 * Full demo seed: wipes auth + app tables, then loads categories, users (with Better Auth
 * credential accounts), sales + lots (all statuses/types), bids, watchlist, notifications, payments.
 *
 * Run: DATABASE_URL=... pnpm --filter @auction/db db:seed
 *
 * Same password for every seeded account (email/password sign-in).
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

/** One password for all seeded accounts — safe for local/staging only. */
const SEED_PASSWORD = "Password123!";

const ADMIN_ID = "admin-seed-001";
const ALICE_ID = "user-seed-001";
const BOB_ID = "user-seed-002";
const CAROL_ID = "user-seed-003";

const CAT = {
  paintings: "c1000001-0000-4000-8000-000000000001",
  sculpture: "c1000002-0000-4000-8000-000000000002",
  photography: "c1000003-0000-4000-8000-000000000003",
  digital: "c1000004-0000-4000-8000-000000000004",
  mixed: "c1000005-0000-4000-8000-000000000005",
  drawings: "c1000006-0000-4000-8000-000000000006",
  contemporary: "c1000007-0000-4000-8000-000000000007",
  impressionist: "c1000008-0000-4000-8000-000000000008",
  bronze: "c1000009-0000-4000-8000-000000000009",
  finePrints: "c1000010-0000-4000-8000-000000000010",
} as const;

const S = {
  evening: "s1000001-0000-4000-8000-000000000001",
  online: "s1000002-0000-4000-8000-000000000002",
} as const;

/** Fixed UUIDs for seeded item submissions (admin queue / demos). */
const SUB = {
  draft: "d2000001-0000-4000-8000-000000000001",
  submitted: "d2000002-0000-4000-8000-000000000002",
  rejected: "d2000003-0000-4000-8000-000000000003",
  converted: "d2000004-0000-4000-8000-000000000004",
} as const;

const L = {
  ethereal: "b1000001-0000-4000-8000-000000000001",
  winter: "b1000002-0000-4000-8000-000000000002",
  anatomy: "b1000003-0000-4000-8000-000000000003",
  chromatic: "b1000004-0000-4000-8000-000000000004",
  suspended: "b1000005-0000-4000-8000-000000000005",
  void: "b1000006-0000-4000-8000-000000000006",
  nocturnal: "b1000007-0000-4000-8000-000000000007",
  silent: "b1000008-0000-4000-8000-000000000008",
  golden: "b1000009-0000-4000-8000-000000000009",
  amber: "b1000010-0000-4000-8000-000000000010",
  marginal: "b1000011-0000-4000-8000-000000000011",
  recursive: "b1000012-0000-4000-8000-000000000012",
  cancelledLot: "b1000013-0000-4000-8000-000000000013",
  sealedFuture: "b1000014-0000-4000-8000-000000000014",
  paperThin: "b1000015-0000-4000-8000-000000000015",
  riverStudy: "b1000016-0000-4000-8000-000000000016",
} as const;

const IMG = {
  a: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80",
  b: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&q=80",
  c: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80",
  d: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80",
  e: "https://images.unsplash.com/photo-1501472312651-726afe119ff1?w=1200&q=80",
} as const;

async function clearAll(db: ReturnType<typeof drizzle<typeof schema>>) {
  const {
    payment,
    notification,
    watchlist,
    bid,
    itemSubmission,
    lot,
    sale,
    category,
    session,
    account,
    verification,
    user,
  } = schema;
  await db.delete(payment);
  await db.delete(notification);
  await db.delete(watchlist);
  await db.delete(bid);
  await db.delete(itemSubmission);
  await db.delete(lot);
  await db.delete(sale);
  await db.delete(category);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(user);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  const now = Date.now();
  const day = 86_400_000;
  const stamp = new Date();

  const {
    user,
    account,
    category,
    sale,
    lot,
    bid,
    watchlist,
    notification,
    payment,
    itemSubmission,
  } = schema;

  await clearAll(db);

  const passwordHash = await hashPassword(SEED_PASSWORD);

  const credentialAccount = (userId: string) => ({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    password: passwordHash,
    createdAt: stamp,
    updatedAt: stamp,
  });

  await db.insert(user).values([
    {
      id: ADMIN_ID,
      name: "Eleanor Pereira",
      email: "eleanor.pereira@curator.test",
      emailVerified: true,
      image: null,
      role: "admin",
      createdAt: new Date(now - 180 * day),
      updatedAt: stamp,
    },
    {
      id: ALICE_ID,
      name: "Alice Volkov",
      email: "alice.volkov@curator.test",
      emailVerified: true,
      image: null,
      role: "user",
      createdAt: new Date(now - 120 * day),
      updatedAt: stamp,
    },
    {
      id: BOB_ID,
      name: "Robert Thorne",
      email: "robert.thorne@curator.test",
      emailVerified: true,
      image: null,
      role: "user",
      createdAt: new Date(now - 90 * day),
      updatedAt: stamp,
    },
    {
      id: CAROL_ID,
      name: "Carolina Price",
      email: "carolina.price@curator.test",
      emailVerified: true,
      image: null,
      role: "user",
      createdAt: new Date(now - 45 * day),
      updatedAt: stamp,
    },
  ]);

  await db
    .insert(account)
    .values([
      credentialAccount(ADMIN_ID),
      credentialAccount(ALICE_ID),
      credentialAccount(BOB_ID),
      credentialAccount(CAROL_ID),
    ]);

  await db.insert(category).values([
    { id: CAT.paintings, name: "Paintings", slug: "paintings", parentId: null },
    { id: CAT.sculpture, name: "Sculpture", slug: "sculpture", parentId: null },
    { id: CAT.photography, name: "Photography", slug: "photography", parentId: null },
    { id: CAT.digital, name: "Digital Art", slug: "digital-art", parentId: null },
    { id: CAT.mixed, name: "Mixed Media", slug: "mixed-media", parentId: null },
    { id: CAT.drawings, name: "Drawings", slug: "drawings", parentId: null },
    { id: CAT.finePrints, name: "Fine Prints", slug: "fine-prints", parentId: null },
    { id: CAT.contemporary, name: "Contemporary", slug: "contemporary", parentId: CAT.paintings },
    {
      id: CAT.impressionist,
      name: "Impressionist",
      slug: "impressionist",
      parentId: CAT.paintings,
    },
    { id: CAT.bronze, name: "Bronze", slug: "bronze", parentId: CAT.sculpture },
  ]);

  const activeEnd = new Date(now + 10 * day);
  const activeStart = new Date(now - 2 * day);
  const scheduledStart = new Date(now + 3 * day);
  const scheduledEnd = new Date(now + 20 * day);
  const endedEnd = new Date(now - 30 * day);
  const endedStart = new Date(now - 60 * day);
  const draftStart = new Date(now + 1 * day);
  const draftEnd = new Date(now + 30 * day);
  const soonEnd = new Date(now + 2 * day);

  await db.insert(sale).values([
    {
      id: S.evening,
      title: "Spring Contemporary Evening Sale",
      description:
        "Curated evening session anchored in contemporary painting and sculpture — flagship live window.",
      coverImages: [IMG.a, IMG.b, IMG.a],
      categoryId: CAT.paintings,
      status: "active",
      startTime: activeStart,
      endTime: new Date(now + 14 * day),
      previewStartTime: new Date(now - 1 * day),
      buyerPremiumRate: "0.25",
      terms: "Buyer's premium 25%; see conditions of sale.",
      createdBy: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: S.online,
      title: "Modern Masters Online Sale",
      description: "Online-only session with intentionally mixed media — browse across categories.",
      coverImages: [IMG.c, IMG.d],
      categoryId: null,
      status: "active",
      startTime: scheduledStart,
      endTime: scheduledEnd,
      previewStartTime: new Date(now + 1 * day),
      buyerPremiumRate: "0.25",
      terms: null,
      createdBy: ADMIN_ID,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);

  await db.insert(lot).values([
    {
      id: L.ethereal,
      saleId: S.evening,
      lotNumber: 1,
      sellerId: ALICE_ID,
      title: "Ethereal Form & Found Light",
      description:
        "A large-scale abstract composition exploring luminosity and negative space. Oil and gold leaf on linen.",
      medium: "Oil and gold leaf on linen",
      dimensions: "72 × 96 in (182.9 × 243.8 cm)",
      images: [IMG.a, IMG.b],
      categoryId: CAT.contemporary,
      auctionType: "english",
      startingPrice: "100000.00",
      reservePrice: "120000.00",
      buyNowPrice: null,
      currentPrice: "155000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "500.00",
      startTime: activeStart,
      endTime: activeEnd,
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.winter,
      saleId: S.evening,
      lotNumber: 2,
      sellerId: ALICE_ID,
      title: "The Winter Study",
      description: "Muted palette interior with solitary figure. Contemporary masters series.",
      medium: "Oil on canvas",
      dimensions: "40 × 30 in (101.6 × 76.2 cm)",
      images: [IMG.c],
      categoryId: CAT.impressionist,
      auctionType: "english",
      startingPrice: "70000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "88000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "250.00",
      startTime: activeStart,
      endTime: new Date(now + 7 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.anatomy,
      saleId: S.evening,
      lotNumber: 3,
      sellerId: ALICE_ID,
      title: "Anatomy of Light",
      description: "Minimalist sculpture series — bronze and plaster.",
      medium: "Bronze, plaster",
      dimensions: "24 × 18 × 14 in",
      images: [IMG.d],
      categoryId: CAT.bronze,
      auctionType: "english",
      startingPrice: "40000.00",
      reservePrice: "50000.00",
      buyNowPrice: null,
      currentPrice: "55000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "100.00",
      startTime: activeStart,
      endTime: new Date(now + 5 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.chromatic,
      saleId: S.evening,
      lotNumber: 4,
      sellerId: ALICE_ID,
      title: "Chromatic Resonance",
      description: "Geometric color-field work with archival pigments on panel.",
      medium: "Pigment on panel",
      dimensions: "60 × 60 in",
      images: [IMG.b, IMG.a],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "180000.00",
      reservePrice: "200000.00",
      buyNowPrice: null,
      currentPrice: "210000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1000.00",
      startTime: activeStart,
      endTime: new Date(now + 14 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.suspended,
      saleId: S.evening,
      lotNumber: 5,
      sellerId: ALICE_ID,
      title: "Suspended Memory",
      description: "Mixed media assemblage with found objects and encaustic.",
      medium: "Encaustic, found objects",
      dimensions: "36 × 48 in",
      images: [IMG.c],
      categoryId: CAT.mixed,
      auctionType: "english",
      startingPrice: "25000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "34000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "50.00",
      startTime: activeStart,
      endTime: new Date(now + 4 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.void,
      saleId: S.online,
      lotNumber: 1,
      sellerId: ALICE_ID,
      title: "Void and Presence",
      description: "Dutch auction lot — price decreases until first bidder accepts.",
      medium: "Digital print, edition 1/8",
      dimensions: "32 × 32 in",
      images: [IMG.d],
      categoryId: CAT.digital,
      auctionType: "dutch",
      startingPrice: "120000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "95000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: activeStart,
      endTime: new Date(now + 6 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: "2500.00",
      dutchDecrementIntervalMs: 120_000,
      dutchLastDecrementAt: new Date(now - 120_000),
    },
    {
      id: L.nocturnal,
      saleId: S.online,
      lotNumber: 2,
      sellerId: ALICE_ID,
      title: "Nocturnal Atlas",
      description: "Large format photograph, edition 2 of 5.",
      medium: "Archival pigment print",
      dimensions: "48 × 72 in",
      images: [IMG.a],
      categoryId: CAT.photography,
      auctionType: "dutch",
      startingPrice: "130000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "120000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: scheduledStart,
      endTime: scheduledEnd,
      status: "scheduled",
      winnerId: null,
      dutchDecrementAmount: "3000.00",
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.silent,
      saleId: S.online,
      lotNumber: 3,
      sellerId: ALICE_ID,
      title: "Silent Architecture",
      description: "Sealed bid lot — highest undisclosed offer wins after close.",
      medium: "Ink on paper",
      dimensions: "22 × 30 in",
      images: [IMG.b],
      categoryId: CAT.sculpture,
      auctionType: "sealed",
      startingPrice: "50000.00",
      reservePrice: "60000.00",
      buyNowPrice: null,
      currentPrice: "67000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: activeStart,
      endTime: new Date(now + 8 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.golden,
      saleId: null,
      lotNumber: null,
      sellerId: ALICE_ID,
      title: "Golden Meridian",
      description: "Buy-it-now contemporary edition with certificate. Sold via instant purchase.",
      medium: "Giclée on cotton rag",
      dimensions: "18 × 24 in",
      images: [IMG.c],
      categoryId: CAT.digital,
      auctionType: "buy_it_now",
      startingPrice: "28000.00",
      reservePrice: null,
      buyNowPrice: "28000.00",
      currentPrice: "28000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: new Date(now - 20 * day),
      endTime: new Date(now - 14 * day),
      status: "ended",
      winnerId: CAROL_ID,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.amber,
      saleId: S.online,
      lotNumber: 4,
      sellerId: ALICE_ID,
      title: "The Amber Hours",
      description: "Sold — private collection. Oil on canvas, provenance documented.",
      medium: "Oil on canvas",
      dimensions: "55 × 70 in",
      images: [IMG.a, IMG.d],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "300000.00",
      reservePrice: "350000.00",
      buyNowPrice: null,
      currentPrice: "420000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "5000.00",
      startTime: endedStart,
      endTime: endedEnd,
      status: "ended",
      winnerId: BOB_ID,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.marginal,
      saleId: S.online,
      lotNumber: 5,
      sellerId: ALICE_ID,
      title: "Marginal Figures",
      description: "Ended auction — figurative study in charcoal and ink.",
      medium: "Charcoal, ink",
      dimensions: "30 × 40 in",
      images: [IMG.b],
      categoryId: CAT.drawings,
      auctionType: "english",
      startingPrice: "80000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "115000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "500.00",
      startTime: endedStart,
      endTime: endedEnd,
      status: "ended",
      winnerId: BOB_ID,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.recursive,
      saleId: null,
      lotNumber: null,
      sellerId: ALICE_ID,
      title: "Recursive Dreams",
      description: "Draft lot — not yet published to the live saleroom.",
      medium: "Acrylic on board",
      dimensions: "24 × 24 in",
      images: [IMG.d],
      categoryId: CAT.mixed,
      auctionType: "english",
      startingPrice: "15000.00",
      reservePrice: "18000.00",
      buyNowPrice: null,
      currentPrice: "15000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "25.00",
      startTime: draftStart,
      endTime: draftEnd,
      status: "draft",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.cancelledLot,
      saleId: null,
      lotNumber: null,
      sellerId: BOB_ID,
      title: "River Light (withdrawn)",
      description: "Lot withdrawn by the house before opening.",
      medium: "Watercolor",
      dimensions: "12 × 16 in",
      images: [IMG.e],
      categoryId: CAT.finePrints,
      auctionType: "english",
      startingPrice: "5000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "5000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "100.00",
      startTime: activeStart,
      endTime: soonEnd,
      status: "cancelled",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.sealedFuture,
      saleId: null,
      lotNumber: null,
      sellerId: ALICE_ID,
      title: "Sealed Study — November",
      description: "Future sealed sale; reserve applies.",
      medium: "Graphite",
      dimensions: "11 × 14 in",
      images: [IMG.c],
      categoryId: CAT.drawings,
      auctionType: "sealed",
      startingPrice: "12000.00",
      reservePrice: "15000.00",
      buyNowPrice: null,
      currentPrice: "12000.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: scheduledStart,
      endTime: scheduledEnd,
      status: "scheduled",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.paperThin,
      saleId: null,
      lotNumber: null,
      sellerId: ALICE_ID,
      title: "Paper Thin Horizon",
      description: "Graphite and silverpoint on toned paper.",
      medium: "Silverpoint",
      dimensions: "9 × 12 in",
      images: [IMG.e],
      categoryId: CAT.drawings,
      auctionType: "english",
      startingPrice: "3200.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "3200.00",
      buyerPremiumRate: "0.20",
      minBidIncrement: "50.00",
      startTime: activeStart,
      endTime: new Date(now + 3 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: L.riverStudy,
      saleId: null,
      lotNumber: null,
      sellerId: ALICE_ID,
      title: "River Study — Blue Hour",
      description: "Plein air panel from the winter residency program.",
      medium: "Oil on panel",
      dimensions: "10 × 12 in",
      images: [IMG.a],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "4500.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "5200.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "100.00",
      startTime: activeStart,
      endTime: new Date(now + 9 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
  ]);

  await db.insert(itemSubmission).values([
    {
      id: SUB.draft,
      sellerId: CAROL_ID,
      title: "Study in Ultramarine",
      description:
        "Small oil sketch from my private collection — exploring the boundary between figurative and gestural brushwork.",
      medium: "Oil on paper",
      dimensions: "11 × 14 in",
      images: [IMG.a],
      askingPrice: "2500.00",
      reservePrice: null,
      categoryId: CAT.paintings,
      submitterNotes: "Still gathering the original gallery invoice before submitting.",
      status: "draft",
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      rejectionReason: null,
      convertedLotId: null,
      createdAt: new Date(now - 2 * day),
      updatedAt: new Date(now - 2 * day),
    },
    {
      id: SUB.submitted,
      sellerId: BOB_ID,
      title: "Bronze Maquette — field cast, 2024",
      description:
        "Small cast acquired directly from the artist's 2024 residency. Numbered 3/8 with original patina.",
      medium: "Bronze, cast",
      dimensions: "8 × 6 × 5 in",
      images: [IMG.b],
      askingPrice: "12000.00",
      reservePrice: "9000.00",
      categoryId: CAT.bronze,
      submitterNotes: "Certificate of authenticity and studio invoice attached.",
      status: "submitted",
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      rejectionReason: null,
      convertedLotId: null,
      createdAt: new Date(now - 1 * day),
      updatedAt: new Date(now - 1 * day),
    },
    {
      id: SUB.rejected,
      sellerId: CAROL_ID,
      title: "Untitled digital collage, 2023",
      description: "Digital print, artist-signed. Acquired second-hand at a student show.",
      medium: "Archival inkjet print",
      dimensions: "24 × 24 in",
      images: [IMG.d],
      askingPrice: "800.00",
      reservePrice: null,
      categoryId: CAT.digital,
      submitterNotes: "Edition size unclear — artist contacted but no response.",
      status: "rejected",
      reviewedBy: ADMIN_ID,
      reviewedAt: new Date(now - 3 * day),
      reviewNotes: "Editioning and provenance must be documented before relisting.",
      rejectionReason:
        "Insufficient provenance: edition size and artist signature cannot be verified.",
      convertedLotId: null,
      createdAt: new Date(now - 4 * day),
      updatedAt: new Date(now - 3 * day),
    },
    {
      id: SUB.converted,
      sellerId: ALICE_ID,
      title: "Recursive Dreams",
      description:
        "Intake record for the catalogued lot Recursive Dreams — approved for an upcoming sale.",
      medium: "Acrylic on board",
      dimensions: "24 × 24 in",
      images: [IMG.d],
      askingPrice: "15000.00",
      reservePrice: "18000.00",
      categoryId: CAT.mixed,
      submitterNotes: "Approved and catalogued; waiting on sale assignment.",
      status: "converted",
      reviewedBy: ADMIN_ID,
      reviewedAt: new Date(now - 5 * day),
      reviewNotes: "Provenance verified; mapped to draft lot.",
      rejectionReason: null,
      convertedLotId: L.recursive,
      createdAt: new Date(now - 6 * day),
      updatedAt: new Date(now - 5 * day),
    },
  ]);

  const hour = 3_600_000;
  const mkBid = (
    lotId: string,
    bidderId: string,
    amount: string,
    isWinning: boolean,
    agoMs: number,
  ): typeof bid.$inferInsert => ({
    lotId,
    bidderId,
    amount,
    isWinning,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt: new Date(now - agoMs),
  });

  const bidRows: (typeof bid.$inferInsert)[] = [
    mkBid(L.ethereal, CAROL_ID, "115000.00", false, 3 * day),
    mkBid(L.ethereal, BOB_ID, "130000.00", false, 2 * day),
    mkBid(L.ethereal, CAROL_ID, "140000.00", false, 1 * day),
    mkBid(L.ethereal, BOB_ID, "155000.00", true, 2 * hour),

    mkBid(L.winter, BOB_ID, "75000.00", false, 2 * day),
    mkBid(L.winter, CAROL_ID, "82000.00", false, 1 * day),
    mkBid(L.winter, BOB_ID, "88000.00", true, 6 * hour),

    mkBid(L.anatomy, CAROL_ID, "50000.00", false, 3 * day),
    mkBid(L.anatomy, BOB_ID, "55000.00", true, 1 * day),

    mkBid(L.chromatic, CAROL_ID, "195000.00", false, 4 * day),
    mkBid(L.chromatic, BOB_ID, "210000.00", true, 6 * hour),

    mkBid(L.suspended, BOB_ID, "34000.00", true, 1 * day),

    mkBid(L.void, BOB_ID, "95000.00", true, 1 * hour),

    mkBid(L.silent, BOB_ID, "62000.00", false, 2 * day),
    mkBid(L.silent, CAROL_ID, "67000.00", true, 1 * day),

    mkBid(L.golden, CAROL_ID, "28000.00", true, 14 * day),

    mkBid(L.amber, CAROL_ID, "360000.00", false, 45 * day),
    mkBid(L.amber, BOB_ID, "380000.00", false, 40 * day),
    mkBid(L.amber, CAROL_ID, "400000.00", false, 35 * day),
    mkBid(L.amber, BOB_ID, "420000.00", true, 31 * day),

    mkBid(L.marginal, CAROL_ID, "95000.00", false, 40 * day),
    mkBid(L.marginal, BOB_ID, "115000.00", true, 32 * day),

    mkBid(L.paperThin, CAROL_ID, "3200.00", true, 1 * day),

    mkBid(L.riverStudy, CAROL_ID, "4500.00", false, 3 * day),
    mkBid(L.riverStudy, BOB_ID, "5200.00", true, 1 * day),
  ];
  await db.insert(bid).values(bidRows);

  await db.insert(watchlist).values([
    { userId: BOB_ID, lotId: L.ethereal },
    { userId: BOB_ID, lotId: L.winter },
    { userId: BOB_ID, lotId: L.chromatic },
    { userId: BOB_ID, lotId: L.sealedFuture },
    { userId: CAROL_ID, lotId: L.chromatic },
    { userId: CAROL_ID, lotId: L.silent },
    { userId: CAROL_ID, lotId: L.riverStudy },
    { userId: CAROL_ID, lotId: L.nocturnal },
  ]);

  const notifId = () => randomUUID();
  await db.insert(notification).values([
    {
      id: notifId(),
      userId: CAROL_ID,
      type: "outbid",
      title: "You were outbid",
      message: "Robert placed a higher bid on Chromatic Resonance.",
      lotId: L.chromatic,
      read: false,
      createdAt: new Date(now - 6 * 3600_000),
    },
    {
      id: notifId(),
      userId: CAROL_ID,
      type: "ending_soon",
      title: "Auction ending soon",
      message: "Paper Thin Horizon closes in under 72 hours.",
      lotId: L.paperThin,
      read: true,
      createdAt: new Date(now - 12 * 3600_000),
    },
    {
      id: notifId(),
      userId: ALICE_ID,
      type: "sale",
      title: "Lot sold",
      message: "The Amber Hours has settled — payment captured.",
      lotId: L.amber,
      read: true,
      createdAt: new Date(now - 29 * day),
    },
    {
      id: notifId(),
      userId: BOB_ID,
      type: "won",
      title: "You won an auction",
      message: "Congratulations — you won The Amber Hours for $420,000.",
      lotId: L.amber,
      read: false,
      createdAt: new Date(now - 30 * day),
    },
    {
      id: notifId(),
      userId: CAROL_ID,
      type: "watchlist",
      title: "Lot update",
      message: "Silent Architecture has new sealed bids.",
      lotId: L.silent,
      read: false,
      createdAt: new Date(now - 1800_000),
    },
    {
      id: notifId(),
      userId: ADMIN_ID,
      type: "submission_received_for_review",
      title: "New submission awaiting review",
      message: "Robert Thorne submitted 'Bronze Maquette — field cast, 2024' for review.",
      lotId: null,
      read: false,
      createdAt: new Date(now - 1 * day),
    },
    {
      id: notifId(),
      userId: ADMIN_ID,
      type: "system",
      title: "Seed data loaded",
      message: "Demo catalog is ready for QA.",
      lotId: null,
      read: true,
      createdAt: stamp,
    },
  ]);

  const payId = () => randomUUID();
  await db.insert(payment).values([
    {
      id: payId(),
      lotId: L.amber,
      buyerId: BOB_ID,
      sellerId: ALICE_ID,
      amount: "525000.00",
      platformFee: "26250.00",
      stripePaymentIntentId: "pi_seed_demo_captured",
      status: "captured",
      createdAt: new Date(now - 29 * day),
    },
    {
      id: payId(),
      lotId: L.marginal,
      buyerId: BOB_ID,
      sellerId: ALICE_ID,
      amount: "143750.00",
      platformFee: "7187.50",
      stripePaymentIntentId: null,
      status: "pending",
      createdAt: new Date(now - 28 * day),
    },
    {
      id: payId(),
      lotId: L.golden,
      buyerId: CAROL_ID,
      sellerId: ALICE_ID,
      amount: "35000.00",
      platformFee: "1750.00",
      stripePaymentIntentId: "pi_seed_demo_refunded",
      status: "refunded",
      createdAt: new Date(now - 14 * day),
    },
  ]);

  console.log("");
  console.log("Seed complete — full demo dataset (all tables touched).");
  console.log("");
  console.log("  Login (email / password):");
  console.log(`    eleanor.pereira@curator.test  / ${SEED_PASSWORD}   (admin)`);
  console.log(`    alice.volkov@curator.test     / ${SEED_PASSWORD}   (user)`);
  console.log(`    robert.thorne@curator.test    / ${SEED_PASSWORD}   (user)`);
  console.log(`    carolina.price@curator.test   / ${SEED_PASSWORD}   (user)`);
  console.log("");
  console.log("  Includes: 2 sales + 16 lots (10 in sales, 6 standalone), nested categories,");
  console.log(
    "  all lot auction types & statuses (incl. cancelled), bids, watchlists, notifications, payments,",
  );
  console.log("  item submissions (draft, submitted, rejected, converted).");
  console.log("");

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

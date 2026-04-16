/**
 * Full demo seed: wipes auth + app tables, then loads categories, users (with Better Auth
 * credential accounts), auctions (all statuses/types), bids, watchlist, notifications, payments.
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
const SELLER_ID = "seller-seed-001";
const BUYER_BOB = "buyer-seed-001";
const BUYER_CAROL = "buyer-seed-002";
const BUYER_DAVE = "buyer-seed-003";

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

const A = {
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
    auction,
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
  await db.delete(auction);
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

  const { user, account, category, auction, bid, watchlist, notification, payment } = schema;

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
      name: "Admin Curator",
      email: "admin@auction.test",
      emailVerified: true,
      image: null,
      role: "admin",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: SELLER_ID,
      name: "Alice Volkov",
      email: "alice@curator.test",
      emailVerified: true,
      image: null,
      role: "seller",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: BUYER_BOB,
      name: "Bob Thorne",
      email: "bob@curator.test",
      emailVerified: true,
      image: null,
      role: "buyer",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: BUYER_CAROL,
      name: "Carol Price",
      email: "carol@curator.test",
      emailVerified: true,
      image: null,
      role: "buyer",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: BUYER_DAVE,
      name: "Dave Mason",
      email: "dave@curator.test",
      emailVerified: true,
      image: null,
      role: "buyer",
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);

  await db
    .insert(account)
    .values([
      credentialAccount(ADMIN_ID),
      credentialAccount(SELLER_ID),
      credentialAccount(BUYER_BOB),
      credentialAccount(BUYER_CAROL),
      credentialAccount(BUYER_DAVE),
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

  await db.insert(auction).values([
    {
      id: A.ethereal,
      sellerId: SELLER_ID,
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
      id: A.winter,
      sellerId: SELLER_ID,
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
      id: A.anatomy,
      sellerId: SELLER_ID,
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
      id: A.chromatic,
      sellerId: SELLER_ID,
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
      id: A.suspended,
      sellerId: SELLER_ID,
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
      id: A.void,
      sellerId: SELLER_ID,
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
      id: A.nocturnal,
      sellerId: SELLER_ID,
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
      id: A.silent,
      sellerId: SELLER_ID,
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
      id: A.golden,
      sellerId: SELLER_ID,
      title: "Golden Meridian",
      description: "Buy-it-now contemporary edition with certificate.",
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
      startTime: activeStart,
      endTime: new Date(now + 30 * day),
      status: "active",
      winnerId: null,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: A.amber,
      sellerId: SELLER_ID,
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
      winnerId: BUYER_BOB,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: A.marginal,
      sellerId: SELLER_ID,
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
      winnerId: BUYER_BOB,
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
    },
    {
      id: A.recursive,
      sellerId: SELLER_ID,
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
      id: A.cancelledLot,
      sellerId: SELLER_ID,
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
      id: A.sealedFuture,
      sellerId: SELLER_ID,
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
      id: A.paperThin,
      sellerId: SELLER_ID,
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
      id: A.riverStudy,
      sellerId: SELLER_ID,
      title: "River Study — Blue Hour",
      description: "Plein air panel from the winter residency program.",
      medium: "Oil on panel",
      dimensions: "10 × 12 in",
      images: [IMG.a],
      categoryId: CAT.photography,
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

  const bidRows: (typeof bid.$inferInsert)[] = [
    {
      auctionId: A.ethereal,
      bidderId: BUYER_BOB,
      amount: "130000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.ethereal,
      bidderId: BUYER_CAROL,
      amount: "140000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.ethereal,
      bidderId: BUYER_BOB,
      amount: "155000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.ethereal,
      bidderId: BUYER_DAVE,
      amount: "125000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.winter,
      bidderId: BUYER_BOB,
      amount: "75000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.winter,
      bidderId: BUYER_BOB,
      amount: "88000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.winter,
      bidderId: BUYER_CAROL,
      amount: "82000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.anatomy,
      bidderId: BUYER_BOB,
      amount: "55000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.chromatic,
      bidderId: BUYER_CAROL,
      amount: "195000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.chromatic,
      bidderId: BUYER_BOB,
      amount: "210000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.suspended,
      bidderId: BUYER_BOB,
      amount: "34000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.void,
      bidderId: BUYER_BOB,
      amount: "95000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.silent,
      bidderId: BUYER_BOB,
      amount: "62000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.silent,
      bidderId: BUYER_CAROL,
      amount: "67000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.golden,
      bidderId: BUYER_DAVE,
      amount: "28000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.amber,
      bidderId: BUYER_BOB,
      amount: "380000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.amber,
      bidderId: BUYER_BOB,
      amount: "420000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.marginal,
      bidderId: BUYER_BOB,
      amount: "115000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.paperThin,
      bidderId: BUYER_CAROL,
      amount: "3200.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.riverStudy,
      bidderId: BUYER_DAVE,
      amount: "5000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: A.riverStudy,
      bidderId: BUYER_BOB,
      amount: "5200.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
  ];
  await db.insert(bid).values(bidRows);

  await db.insert(watchlist).values([
    { userId: BUYER_BOB, auctionId: A.ethereal },
    { userId: BUYER_BOB, auctionId: A.winter },
    { userId: BUYER_BOB, auctionId: A.chromatic },
    { userId: BUYER_CAROL, auctionId: A.chromatic },
    { userId: BUYER_CAROL, auctionId: A.silent },
    { userId: BUYER_DAVE, auctionId: A.golden },
  ]);

  const notifId = () => randomUUID();
  await db.insert(notification).values([
    {
      id: notifId(),
      userId: BUYER_BOB,
      type: "outbid",
      title: "You were outbid",
      message: "Carol placed a higher bid on Chromatic Resonance.",
      auctionId: A.chromatic,
      read: false,
      createdAt: new Date(now - 3600_000),
    },
    {
      id: notifId(),
      userId: BUYER_BOB,
      type: "ending_soon",
      title: "Auction ending soon",
      message: "Paper Thin Horizon closes in under 72 hours.",
      auctionId: A.paperThin,
      read: true,
      createdAt: new Date(now - 7200_000),
    },
    {
      id: notifId(),
      userId: SELLER_ID,
      type: "sale",
      title: "Lot sold",
      message: "The Amber Hours has settled — payment record created.",
      auctionId: A.amber,
      read: false,
      createdAt: new Date(now - 86400_000),
    },
    {
      id: notifId(),
      userId: BUYER_CAROL,
      type: "watchlist",
      title: "Lot update",
      message: "Silent Architecture has new sealed bids.",
      auctionId: A.silent,
      read: false,
      createdAt: new Date(now - 1800_000),
    },
    {
      id: notifId(),
      userId: ADMIN_ID,
      type: "system",
      title: "Seed data loaded",
      message: "Demo catalog is ready for QA.",
      auctionId: null,
      read: true,
      createdAt: stamp,
    },
  ]);

  const payId = () => randomUUID();
  await db.insert(payment).values([
    {
      id: payId(),
      auctionId: A.amber,
      buyerId: BUYER_BOB,
      sellerId: SELLER_ID,
      amount: "525000.00",
      platformFee: "26250.00",
      stripePaymentIntentId: "pi_seed_demo_captured",
      status: "captured",
      createdAt: new Date(now - 5 * day),
    },
    {
      id: payId(),
      auctionId: A.marginal,
      buyerId: BUYER_BOB,
      sellerId: SELLER_ID,
      amount: "143750.00",
      platformFee: "7187.50",
      stripePaymentIntentId: null,
      status: "pending",
      createdAt: new Date(now - 2 * day),
    },
    {
      id: payId(),
      auctionId: A.riverStudy,
      buyerId: BUYER_BOB,
      sellerId: SELLER_ID,
      amount: "5000.00",
      platformFee: "250.00",
      stripePaymentIntentId: "pi_seed_demo_auth",
      status: "authorized",
      createdAt: new Date(now - 6 * day),
    },
    {
      id: payId(),
      auctionId: A.golden,
      buyerId: BUYER_DAVE,
      sellerId: SELLER_ID,
      amount: "35000.00",
      platformFee: "1750.00",
      stripePaymentIntentId: null,
      status: "refunded",
      createdAt: new Date(now - 12 * day),
    },
  ]);

  console.log("");
  console.log("Seed complete — full demo dataset (all tables touched).");
  console.log("");
  console.log("  Login (email / password):");
  console.log(`    admin@auction.test     / ${SEED_PASSWORD}`);
  console.log(`    alice@curator.test     / ${SEED_PASSWORD}`);
  console.log(`    bob@curator.test       / ${SEED_PASSWORD}`);
  console.log(`    carol@curator.test     / ${SEED_PASSWORD}`);
  console.log(`    dave@curator.test      / ${SEED_PASSWORD}`);
  console.log("");
  console.log("  Includes: nested categories, all auction types & statuses (incl. cancelled),");
  console.log("  multi-bidder bids, watchlists, notifications, and sample payments.");
  console.log("");

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

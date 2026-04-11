import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadEnvFilesIfNeeded } from "./load-env.js";
import * as schema from "./schema/index.js";

const { Pool } = pg;

const SELLER_ID = "seller-seed-001";
const BUYER_ID = "buyer-seed-001";

const CAT = {
  paintings: "c1000001-0000-4000-8000-000000000001",
  sculpture: "c1000002-0000-4000-8000-000000000002",
  photography: "c1000003-0000-4000-8000-000000000003",
  digital: "c1000004-0000-4000-8000-000000000004",
  mixed: "c1000005-0000-4000-8000-000000000005",
} as const;

const IMG = {
  a: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1200&q=80",
  b: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&q=80",
  c: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80",
  d: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&q=80",
} as const;

const AUCTION = {
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
} as const;

async function main() {
  loadEnvFilesIfNeeded();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  const now = Date.now();
  const day = 86_400_000;

  const { user, category, auction, bid } = schema;

  await db.delete(bid);
  await db.delete(auction);
  await db.delete(category);

  const stamp = new Date();

  await db
    .insert(user)
    .values([
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
        id: BUYER_ID,
        name: "Bob Thorne",
        email: "bob@curator.test",
        emailVerified: true,
        image: null,
        role: "buyer",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ])
    .onConflictDoNothing({ target: user.id });

  await db.insert(category).values([
    { id: CAT.paintings, name: "Paintings", slug: "paintings", parentId: null },
    { id: CAT.sculpture, name: "Sculpture", slug: "sculpture", parentId: null },
    { id: CAT.photography, name: "Photography", slug: "photography", parentId: null },
    { id: CAT.digital, name: "Digital Art", slug: "digital-art", parentId: null },
    { id: CAT.mixed, name: "Mixed Media", slug: "mixed-media", parentId: null },
  ]);

  const activeEnd = new Date(now + 10 * day);
  const activeStart = new Date(now - 2 * day);
  const scheduledStart = new Date(now + 3 * day);
  const scheduledEnd = new Date(now + 20 * day);
  const endedEnd = new Date(now - 30 * day);
  const endedStart = new Date(now - 60 * day);
  const draftStart = new Date(now + 1 * day);
  const draftEnd = new Date(now + 30 * day);

  await db.insert(auction).values([
    {
      id: AUCTION.ethereal,
      sellerId: SELLER_ID,
      title: "Ethereal Form & Found Light",
      description:
        "A large-scale abstract composition exploring luminosity and negative space. Oil and gold leaf on linen.",
      images: [IMG.a, IMG.b],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "100000.00",
      reservePrice: "120000.00",
      buyNowPrice: null,
      currentPrice: "142000.00",
      startTime: activeStart,
      endTime: activeEnd,
      status: "active",
      winnerId: null,
    },
    {
      id: AUCTION.winter,
      sellerId: SELLER_ID,
      title: "The Winter Study",
      description: "Muted palette interior with solitary figure. Contemporary masters series.",
      images: [IMG.c],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "70000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "88000.00",
      startTime: activeStart,
      endTime: new Date(now + 7 * day),
      status: "active",
      winnerId: null,
    },
    {
      id: AUCTION.anatomy,
      sellerId: SELLER_ID,
      title: "Anatomy of Light",
      description: "Minimalist sculpture series — bronze and plaster.",
      images: [IMG.d],
      categoryId: CAT.sculpture,
      auctionType: "english",
      startingPrice: "40000.00",
      reservePrice: "50000.00",
      buyNowPrice: null,
      currentPrice: "55000.00",
      startTime: activeStart,
      endTime: new Date(now + 5 * day),
      status: "active",
      winnerId: null,
    },
    {
      id: AUCTION.chromatic,
      sellerId: SELLER_ID,
      title: "Chromatic Resonance",
      description: "Geometric color-field work with archival pigments on panel.",
      images: [IMG.b, IMG.a],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "180000.00",
      reservePrice: "200000.00",
      buyNowPrice: null,
      currentPrice: "210000.00",
      startTime: activeStart,
      endTime: new Date(now + 14 * day),
      status: "active",
      winnerId: null,
    },
    {
      id: AUCTION.suspended,
      sellerId: SELLER_ID,
      title: "Suspended Memory",
      description: "Mixed media assemblage with found objects and encaustic.",
      images: [IMG.c],
      categoryId: CAT.mixed,
      auctionType: "english",
      startingPrice: "25000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "34000.00",
      startTime: activeStart,
      endTime: new Date(now + 4 * day),
      status: "active",
      winnerId: null,
    },
    {
      id: AUCTION.void,
      sellerId: SELLER_ID,
      title: "Void and Presence",
      description: "Dutch auction lot — price decreases until first bidder accepts.",
      images: [IMG.d],
      categoryId: CAT.digital,
      auctionType: "dutch",
      startingPrice: "120000.00",
      reservePrice: "85000.00",
      buyNowPrice: null,
      currentPrice: "95000.00",
      startTime: activeStart,
      endTime: new Date(now + 6 * day),
      status: "active",
      winnerId: null,
    },
    {
      id: AUCTION.nocturnal,
      sellerId: SELLER_ID,
      title: "Nocturnal Atlas",
      description: "Large format photograph, edition 2 of 5.",
      images: [IMG.a],
      categoryId: CAT.photography,
      auctionType: "dutch",
      startingPrice: "130000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "120000.00",
      startTime: scheduledStart,
      endTime: scheduledEnd,
      status: "scheduled",
      winnerId: null,
    },
    {
      id: AUCTION.silent,
      sellerId: SELLER_ID,
      title: "Silent Architecture",
      description: "Sealed bid lot — highest undisclosed offer wins after close.",
      images: [IMG.b],
      categoryId: CAT.sculpture,
      auctionType: "sealed",
      startingPrice: "50000.00",
      reservePrice: "60000.00",
      buyNowPrice: null,
      currentPrice: "67000.00",
      startTime: activeStart,
      endTime: new Date(now + 8 * day),
      status: "active",
      winnerId: null,
    },
    {
      id: AUCTION.golden,
      sellerId: SELLER_ID,
      title: "Golden Meridian",
      description: "Buy-it-now contemporary edition with certificate.",
      images: [IMG.c],
      categoryId: CAT.digital,
      auctionType: "buy_it_now",
      startingPrice: "28000.00",
      reservePrice: null,
      buyNowPrice: "28000.00",
      currentPrice: "28000.00",
      startTime: activeStart,
      endTime: new Date(now + 30 * day),
      status: "active",
      winnerId: null,
    },
    {
      id: AUCTION.amber,
      sellerId: SELLER_ID,
      title: "The Amber Hours",
      description: "Sold — private collection. Oil on canvas, provenance documented.",
      images: [IMG.a, IMG.d],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "300000.00",
      reservePrice: "350000.00",
      buyNowPrice: null,
      currentPrice: "420000.00",
      startTime: endedStart,
      endTime: endedEnd,
      status: "ended",
      winnerId: BUYER_ID,
    },
    {
      id: AUCTION.marginal,
      sellerId: SELLER_ID,
      title: "Marginal Figures",
      description: "Ended auction — figurative study in charcoal and ink.",
      images: [IMG.b],
      categoryId: CAT.paintings,
      auctionType: "english",
      startingPrice: "80000.00",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "115000.00",
      startTime: endedStart,
      endTime: endedEnd,
      status: "ended",
      winnerId: BUYER_ID,
    },
    {
      id: AUCTION.recursive,
      sellerId: SELLER_ID,
      title: "Recursive Dreams",
      description: "Draft lot — not yet published to the live saleroom.",
      images: [IMG.d],
      categoryId: CAT.mixed,
      auctionType: "english",
      startingPrice: "15000.00",
      reservePrice: "18000.00",
      buyNowPrice: null,
      currentPrice: "15000.00",
      startTime: draftStart,
      endTime: draftEnd,
      status: "draft",
      winnerId: null,
    },
  ]);

  await db.insert(bid).values([
    {
      auctionId: AUCTION.ethereal,
      bidderId: BUYER_ID,
      amount: "130000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.ethereal,
      bidderId: BUYER_ID,
      amount: "142000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.winter,
      bidderId: BUYER_ID,
      amount: "75000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.winter,
      bidderId: BUYER_ID,
      amount: "88000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.anatomy,
      bidderId: BUYER_ID,
      amount: "55000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.chromatic,
      bidderId: BUYER_ID,
      amount: "195000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.chromatic,
      bidderId: BUYER_ID,
      amount: "210000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.suspended,
      bidderId: BUYER_ID,
      amount: "34000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.void,
      bidderId: BUYER_ID,
      amount: "95000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.silent,
      bidderId: BUYER_ID,
      amount: "67000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.golden,
      bidderId: BUYER_ID,
      amount: "28000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.amber,
      bidderId: BUYER_ID,
      amount: "380000.00",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.amber,
      bidderId: BUYER_ID,
      amount: "420000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
    {
      auctionId: AUCTION.marginal,
      bidderId: BUYER_ID,
      amount: "115000.00",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
    },
  ]);

  await pool.end();
  console.log("Seed complete: categories, auctions, bids (users upserted if missing).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

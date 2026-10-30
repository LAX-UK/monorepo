import { randomUUID } from "node:crypto";
/**
 * Demo top-up: adds what a live demo needs on top of an environment that already has the base
 * demo seed (or real review data), without removing or resetting anything.
 *
 * - People: a demo collector, Northbank Gallery's owner and buyer agent, a rival bidder, one Bid
 *   staff sign-in per role and the LAX Admin staff sign-ins. Found by email; created only when
 *   missing.
 * - Bid: a live online sale, a saleroom sale, an upcoming sale and two finished sales, with lots,
 *   bids, registrations, watched lots, purchases (due, overdue and paid), Northbank's
 *   consignments in every stage and its payouts (due and paid).
 *
 * Idempotent: every row has a fixed id (or a natural key) and is inserted with
 * `on conflict do nothing`. Sales and lots also refresh their dates, so running it again moves
 * the live sale back to "live". It never deletes or truncates.
 */
import { hashPassword } from "@better-auth/utils/password";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "../../schema/index.js";
import {
  BUYER_PREMIUM_RATE,
  type DemoActors,
  type DemoCatalogue,
  SELLER_COMMISSION_RATE,
  buildDemoCatalogue,
} from "./demo-topup-catalogue.js";
import {
  BASE_EMAILS,
  BASE_ENTITY_SLUGS,
  DEMO_IDS,
  DEMO_PASSWORD,
  DEMO_PEOPLE,
  type DemoPerson,
} from "./demo-topup-ids.js";

/** A database or a transaction on it. */
type Db = PgDatabase<NodePgQueryResultHKT, typeof schema>;

const DAY = 86_400_000;
const money = (pounds: number) => pounds.toFixed(2);

export type DemoTopUpResult = {
  created: string[];
  existing: string[];
  catalogue: { sales: number; lots: number; bids: number; payments: number; submissions: number };
};

export async function runDemoTopUp(db: Db, now: number = Date.now()): Promise<DemoTopUpResult> {
  const people = await ensurePeople(db, now);
  const base = await loadBase(db);
  const actors: DemoActors = {
    collectorUserId: people.ids.collector,
    collectorEntityId: personalEntityOf(DEMO_PEOPLE.collector),
    rivalUserId: people.ids.rivalBidder,
    rivalEntityId: personalEntityOf(DEMO_PEOPLE.rivalBidder),
    northbankBuyerUserId: people.ids.northbankBuyer,
    northbankId: base.northbankId,
    consignorUserId: base.userIds.consignor,
    laxStockId: base.laxStockId,
  };
  await ensureNorthbankTeam(db, now, base, people.ids);

  const catalogue = buildDemoCatalogue(now, actors);
  await writeCatalogue(db, catalogue, base);

  return {
    created: people.created,
    existing: people.existing,
    catalogue: {
      sales: catalogue.sales.length,
      lots: catalogue.lots.length,
      bids: catalogue.bids.length,
      payments: catalogue.payments.length,
      submissions: catalogue.submissions.length,
    },
  };
}

function personalEntityOf(person: DemoPerson): string {
  if (!person.personalEntityId) throw new Error(`[demo-topup] ${person.email} has no account`);
  return person.personalEntityId;
}

// ─── People ────────────────────────────────────────────────────────────────────

type PeopleIds = Record<keyof typeof DEMO_PEOPLE, string>;

async function ensurePeople(db: Db, now: number) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids = {} as PeopleIds;
  const created: string[] = [];
  const existing: string[] = [];
  for (const [key, person] of Object.entries(DEMO_PEOPLE) as [keyof PeopleIds, DemoPerson][]) {
    const [found] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(sql`lower(${schema.user.email}) = ${person.email}`)
      .limit(1);
    if (found) {
      ids[key] = found.id;
      existing.push(person.email);
    } else {
      await createPerson(db, person, passwordHash, now);
      ids[key] = person.userId;
      created.push(person.email);
    }
    if (person.bidStaffRole) {
      await db
        .insert(schema.staffRoleAssignment)
        .values({
          userId: ids[key],
          role: person.bidStaffRole,
          startsAt: new Date(now - 60 * DAY),
          reason: "demo seed",
        })
        .onConflictDoNothing();
    }
  }
  return { ids, created, existing };
}

async function createPerson(db: Db, person: DemoPerson, passwordHash: string, now: number) {
  const name = `${person.firstName} ${person.lastName}`;
  const joined = new Date(now - 90 * DAY);
  const isClient = person.personalEntityId !== null;
  await db.transaction(async (tx) => {
    await tx.insert(schema.user).values({
      id: person.userId,
      name,
      email: person.email,
      emailVerified: true,
      createdAt: joined,
      updatedAt: joined,
    });
    await tx.insert(schema.account).values({
      id: randomUUID(),
      accountId: person.userId,
      providerId: "credential",
      userId: person.userId,
      password: passwordHash,
      createdAt: joined,
      updatedAt: joined,
    });
    await tx.insert(schema.bidUserProfile).values({
      userId: person.userId,
      role: person.bidStaffRole ? "staff" : "client",
      staffRole: person.bidStaffRole,
      kycStatus: isClient ? "approved" : "unverified",
      kycVerifiedAt: isClient ? new Date(now - 80 * DAY) : null,
      signupPersona: isClient ? "individual" : null,
      firstName: person.firstName,
      lastName: person.lastName,
      termsAcceptedAt: joined,
      termsVersion: "demo",
      categoryInterestsOnboardingCompletedAt: joined,
      hasSeenActingContextTooltip: true,
      createdAt: joined,
      updatedAt: joined,
    });
    await tx
      .insert(schema.bidIdentityDirectory)
      .values({
        subjectId: person.userId,
        email: person.email,
        name,
        emailVerified: true,
        identityCreatedAt: joined,
        lastEventId: 0,
      })
      .onConflictDoNothing();
    if (person.personalEntityId) {
      await tx.insert(schema.legalEntity).values({
        id: person.personalEntityId,
        displayName: name,
        legalName: name,
        slug: `${person.firstName}-${person.lastName}-demo`.toLowerCase(),
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: person.userId,
        status: "approved",
        statusChangedAt: joined,
        createdAt: joined,
        updatedAt: joined,
      });
      await tx.insert(schema.legalEntityMember).values({
        legalEntityId: person.personalEntityId,
        userId: person.userId,
        role: "owner",
        isPrimaryAdmin: true,
        acceptedAt: joined,
        createdAt: joined,
      });
      await tx
        .update(schema.bidUserProfile)
        .set({ lastActingLegalEntityId: person.personalEntityId })
        .where(eq(schema.bidUserProfile.userId, person.userId));
    }
  });
}

// ─── What the top-up builds on ─────────────────────────────────────────────────

type Base = {
  northbankId: string;
  laxStockId: string;
  venueId: string | null;
  categoryIdBySlug: Map<string, string>;
  userIds: Record<keyof typeof BASE_EMAILS, string>;
};

async function loadBase(db: Db): Promise<Base> {
  const entities = await db
    .select({ id: schema.legalEntity.id, slug: schema.legalEntity.slug })
    .from(schema.legalEntity)
    .where(inArray(schema.legalEntity.slug, Object.values(BASE_ENTITY_SLUGS)));
  const entityId = (slug: string) => {
    const row = entities.find((e) => e.slug === slug);
    if (!row) throw new Error(`[demo-topup] needs the base demo seed: no account "${slug}"`);
    return row.id;
  };

  const users = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(inArray(sql`lower(${schema.user.email})`, Object.values(BASE_EMAILS)));
  const userIds = {} as Base["userIds"];
  for (const [key, email] of Object.entries(BASE_EMAILS) as [keyof Base["userIds"], string][]) {
    const row = users.find((u) => u.email.toLowerCase() === email);
    if (!row) throw new Error(`[demo-topup] needs the base demo seed: no user ${email}`);
    userIds[key] = row.id;
  }

  const [venue] = await db
    .select({ id: schema.venue.id })
    .from(schema.venue)
    .where(eq(schema.venue.status, "active"))
    .limit(1);
  const categories = await db
    .select({ id: schema.category.id, slug: schema.category.slug })
    .from(schema.category);

  return {
    northbankId: entityId(BASE_ENTITY_SLUGS.northbank),
    laxStockId: entityId(BASE_ENTITY_SLUGS.laxStock),
    venueId: venue?.id ?? null,
    categoryIdBySlug: new Map(categories.map((c) => [c.slug, c.id])),
    userIds,
  };
}

// ─── Northbank Gallery's team ──────────────────────────────────────────────────

async function ensureNorthbankTeam(db: Db, now: number, base: Base, ids: PeopleIds) {
  const members: [string, "owner" | "buyer_agent", number][] = [
    [ids.northbankOwner, "owner", 1],
    [ids.northbankBuyer, "buyer_agent", 2],
  ];
  for (const [userId, role, n] of members) {
    const [active] = await db
      .select({ id: schema.legalEntityMember.id })
      .from(schema.legalEntityMember)
      .where(
        and(
          eq(schema.legalEntityMember.legalEntityId, base.northbankId),
          eq(schema.legalEntityMember.userId, userId),
          isNull(schema.legalEntityMember.removedAt),
        ),
      )
      .limit(1);
    if (active) continue;
    await db
      .insert(schema.legalEntityMember)
      .values({
        id: DEMO_IDS.member(n),
        legalEntityId: base.northbankId,
        userId,
        role,
        invitedByUserId: base.userIds.galleryAdmin,
        invitedAt: new Date(now - (70 - n) * DAY),
        acceptedAt: new Date(now - (69 - n) * DAY),
        createdAt: new Date(now - (70 - n) * DAY),
      })
      .onConflictDoNothing();
  }

  await db
    .insert(schema.buyerAgentAuthorisation)
    .values({
      id: DEMO_IDS.authorisation(1),
      legalEntityId: base.northbankId,
      userId: ids.northbankBuyer,
      saleId: null,
      bidLimit: money(10_000),
      validFrom: new Date(now - 60 * DAY),
      validUntil: null,
      status: "active",
      createdByUserId: ids.northbankOwner,
    })
    .onConflictDoNothing();

  // Northbank's members open their workspace on Northbank rather than another account.
  await db
    .update(schema.bidUserProfile)
    .set({ lastActingLegalEntityId: base.northbankId, hasSeenActingContextTooltip: true })
    .where(
      inArray(schema.bidUserProfile.userId, [
        ids.northbankOwner,
        ids.northbankBuyer,
        base.userIds.galleryAdmin,
        base.userIds.galleryFinance,
        base.userIds.consignor,
        base.userIds.viewer,
      ]),
    );
}

// ─── Sales, lots and what follows from them ────────────────────────────────────

async function writeCatalogue(db: Db, catalogue: DemoCatalogue, base: Base) {
  const category = (slug: string) => base.categoryIdBySlug.get(slug) ?? null;

  for (const sale of catalogue.sales) {
    const dates = {
      status: sale.status,
      startTime: sale.startTime,
      endTime: sale.endTime,
      previewStartTime: sale.previewStartTime,
      updatedAt: new Date(),
    };
    await db
      .insert(schema.sale)
      .values({
        id: sale.id,
        title: sale.title,
        description: sale.description,
        coverImages: [sale.coverImage],
        deliveryMode: sale.deliveryMode,
        allowOnlineBidsBeforeGoLive: sale.deliveryMode === "hybrid",
        buyerPremiumRate: BUYER_PREMIUM_RATE.toFixed(4),
        terms: "Buyer's premium of 25% is added to the hammer price. Payment is due within 7 days.",
        createdByLegalEntityId: base.laxStockId,
        venueId: sale.atVenue ? base.venueId : null,
        ...(sale.atVenue
          ? {
              locationName: "LAX Mayfair Saleroom",
              locationCity: "London",
              locationCountry: "GB",
            }
          : {}),
        ...dates,
      })
      .onConflictDoUpdate({ target: schema.sale.id, set: dates });
    const categoryId = category(sale.categorySlug);
    if (categoryId) {
      const linked = await db
        .select({ one: sql<number>`1` })
        .from(schema.saleCategories)
        .where(eq(schema.saleCategories.saleId, sale.id))
        .limit(1);
      if (linked.length === 0) {
        await db.insert(schema.saleCategories).values({ saleId: sale.id, categoryId });
      }
    }
  }

  for (const lot of catalogue.lots) {
    const dates = { status: lot.status, startTime: lot.startTime, endTime: lot.endTime };
    await db
      .insert(schema.lot)
      .values({
        id: lot.id,
        saleId: lot.saleId,
        lotNumber: lot.lotNumber,
        title: lot.title,
        description: lot.description,
        medium: lot.medium,
        dimensions: lot.dimensions,
        images: [lot.image],
        auctionType: "english",
        startingPrice: money(lot.startingPrice),
        reservePrice: money(lot.reservePrice),
        currentPrice: money(lot.currentPrice),
        minBidIncrement: money(lot.minBidIncrement),
        buyerPremiumRate: BUYER_PREMIUM_RATE.toFixed(4),
        sellerLegalEntityId: lot.sellerEntityId,
        winnerId: lot.winnerUserId,
        buyerLegalEntityId: lot.buyerEntityId,
        marketingDetails: {
          estimate: { low: money(lot.estimateLow), high: money(lot.estimateHigh), currency: "GBP" },
          imageAlts: [lot.title],
        },
        ...dates,
      })
      .onConflictDoUpdate({ target: schema.lot.id, set: dates });
    const categoryId = category(lot.categorySlug);
    if (categoryId) {
      const linked = await db
        .select({ one: sql<number>`1` })
        .from(schema.lotCategories)
        .where(eq(schema.lotCategories.lotId, lot.id))
        .limit(1);
      if (linked.length === 0) {
        await db.insert(schema.lotCategories).values({ lotId: lot.id, categoryId });
      }
    }
  }

  if (catalogue.bids.length > 0) {
    await db
      .insert(schema.bid)
      .values(
        catalogue.bids.map((bid) => ({
          id: bid.id,
          lotId: bid.lotId,
          bidderId: bid.bidderUserId,
          subjectId: bid.bidderUserId,
          buyerLegalEntityId: bid.buyerEntityId,
          amount: money(bid.amount),
          isWinning: bid.isWinning,
          isAutoBid: false,
          placedVia: "web",
          createdAt: bid.createdAt,
        })),
      )
      .onConflictDoNothing();
  }

  await db
    .insert(schema.saleRegistration)
    .values(
      catalogue.registrations.map((r) => ({
        id: r.id,
        saleId: r.saleId,
        userId: r.userId,
        buyerLegalEntityId: r.buyerEntityId,
        status: "approved" as const,
        requestedAt: r.requestedAt,
        decidedAt: r.requestedAt,
        decidedByUserId: base.userIds.admin,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.watchlist)
    .values(
      catalogue.watches.map((w) => ({
        id: w.id,
        userId: w.userId,
        lotId: w.lotId,
        createdAt: w.createdAt,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.payment)
    .values(
      catalogue.payments.map((p) => ({
        id: p.id,
        lotId: p.lotId,
        buyerId: p.buyerUserId,
        buyerLegalEntityId: p.buyerEntityId,
        sellerLegalEntityId: p.sellerEntityId,
        amount: money(p.hammer * (1 + BUYER_PREMIUM_RATE)),
        platformFee: money(p.hammer * BUYER_PREMIUM_RATE),
        stripePaymentIntentId: p.status === "captured" ? `pi_demo_${p.id.slice(-6)}` : null,
        status: p.status,
        createdAt: p.createdAt,
      })),
    )
    .onConflictDoNothing();

  for (const payout of catalogue.payouts) {
    const fee = payout.hammer * SELLER_COMMISSION_RATE;
    await db
      .insert(schema.payout)
      .values({
        id: payout.id,
        legalEntityId: payout.legalEntityId,
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
        grossAmount: money(payout.hammer),
        platformFee: money(fee),
        stripeFee: money(0),
        netAmount: money(payout.hammer - fee),
        status: payout.status,
        stripeTransferId: payout.status === "paid" ? `tr_demo_${payout.id.slice(-6)}` : null,
        processedAt: payout.processedAt,
        createdAt: payout.periodEnd,
      })
      .onConflictDoNothing();
    await db
      .insert(schema.payoutLine)
      .values({
        id: payout.lineId,
        payoutId: payout.id,
        paymentId: payout.paymentId,
        amount: money(payout.hammer),
        kind: "sale",
        createdAt: payout.periodEnd,
      })
      .onConflictDoNothing();
  }

  await db
    .insert(schema.itemSubmission)
    .values(
      catalogue.submissions.map((s) => ({
        id: s.id,
        legalEntityId: s.legalEntityId,
        submittedByUserId: s.submittedByUserId,
        title: s.title,
        description: s.description,
        medium: s.medium || null,
        dimensions: s.dimensions || null,
        yearOfWork: s.yearOfWork || null,
        images: [s.image],
        isSigned: true,
        askingPrice: money(s.askingPrice),
        status: s.status,
        convertedLotId: s.convertedLotId,
        changesRequestedNote: s.changesRequestedNote,
        changesRequestedAt: s.changesRequestedNote ? s.updatedAt : null,
        reviewedBy: s.status === "draft" || s.status === "submitted" ? null : base.userIds.admin,
        reviewedAt: s.status === "draft" || s.status === "submitted" ? null : s.updatedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    )
    .onConflictDoNothing();
  const paintings = category("paintings");
  if (paintings) {
    for (const s of catalogue.submissions) {
      const linked = await db
        .select({ one: sql<number>`1` })
        .from(schema.submissionCategories)
        .where(eq(schema.submissionCategories.submissionId, s.id))
        .limit(1);
      if (linked.length === 0) {
        await db
          .insert(schema.submissionCategories)
          .values({ submissionId: s.id, categoryId: paintings });
      }
    }
  }
}

/**
 * Full demo seed for the Bid database. Runs the demo top-up first (people, Northbank Gallery, the
 * live online sale, finished sales, consignments, payouts), then adds the full catalogue: a timed
 * sale that is live now with lots in all twelve departments, a saleroom sale in a few days, three
 * more upcoming sales with large covers, a finished sale with a withdrawn lot and a held invoice,
 * department pictures, notifications and private sale enquiries.
 *
 * Idempotent: fixed ids and `on conflict` writes; sales and lots refresh their dates so the live
 * sale is live again whenever it is run. Never deletes. Test and local databases only.
 */
import { eq, sql } from "drizzle-orm";
import * as schema from "../../schema/index.js";
import { type FullActors, buildFullCatalogue } from "./demo-full-catalogue.js";
import { COVER_IMAGES, DEPARTMENTS, WORKS } from "./demo-full-works.js";
import { demoImageUrl, departmentHeroSource } from "./demo-images.js";
import type { DemoPayment } from "./demo-topup-catalogue.js";
import { DEMO_IDS, DEMO_PEOPLE } from "./demo-topup-ids.js";
import {
  type Db,
  ensureNorthbankTeam,
  ensurePeople,
  loadBase,
  personalEntityOf,
  runDemoTopUp,
  writeCatalogue,
} from "./demo-topup-seed.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Ids for rows this seed writes outside the sale catalogue. */
const extraId = (group: string, n: number) =>
  `${group}-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const NOTIFICATION_ID = (n: number) => extraId("dec00000", n);
const ENQUIRY_ID = (n: number) => extraId("ded00000", n);

export type DemoFullResult = {
  topUp: Awaited<ReturnType<typeof runDemoTopUp>>;
  sales: number;
  lots: number;
  bids: number;
  departments: number;
};

export async function runDemoFull(db: Db, now: number = Date.now()): Promise<DemoFullResult> {
  const topUp = await runDemoTopUp(db, now);

  const people = await ensurePeople(db, now);
  const base = await loadBase(db);
  await ensureNorthbankTeam(db, now, base, people.ids);

  // The held buyer won a lot but never verified their identity, so their invoice is held.
  await db
    .update(schema.bidUserProfile)
    .set({ kycStatus: "unverified", kycVerifiedAt: null })
    .where(eq(schema.bidUserProfile.userId, people.ids.heldBuyer));

  await ensureDepartments(db, base);
  const refreshed = await loadBase(db);

  const actors: FullActors = {
    collectorUserId: people.ids.collector,
    collectorEntityId: personalEntityOf(DEMO_PEOPLE.collector),
    rivalUserId: people.ids.rivalBidder,
    rivalEntityId: personalEntityOf(DEMO_PEOPLE.rivalBidder),
    northbankBuyerUserId: people.ids.northbankBuyer,
    northbankId: base.northbankId,
    heldUserId: people.ids.heldBuyer,
    heldEntityId: personalEntityOf(DEMO_PEOPLE.heldBuyer),
    payerUserId: people.ids.payBuyer,
    payerEntityId: personalEntityOf(DEMO_PEOPLE.payBuyer),
    laxStockId: base.laxStockId,
  };
  const catalogue = buildFullCatalogue(now, actors);
  await writeCatalogue(db, catalogue, refreshed);
  await writeApprovedSourceOfFunds(
    db,
    now,
    people.ids.payBuyer,
    refreshed.userIds.admin,
    catalogue,
  );

  // Lot pictures on rows from earlier runs, and a large cover on the top-up's upcoming sale.
  for (const lot of catalogue.lots) {
    await db
      .update(schema.lot)
      .set({ images: [lot.image] })
      .where(eq(schema.lot.id, lot.id));
  }
  const covers = [
    ...catalogue.sales.map((s) => ({ id: s.id, image: s.coverImage })),
    // The top-up's two live sales lead the home page, so they get large covers too.
    { id: DEMO_IDS.sale(1), image: demoImageUrl(COVER_IMAGES.harvesters, "cover") },
    { id: DEMO_IDS.sale(2), image: demoImageUrl(COVER_IMAGES.moon, "cover") },
    { id: DEMO_IDS.sale(3), image: demoImageUrl(COVER_IMAGES.vanGogh, "cover") },
  ];
  for (const { id, image } of covers) {
    // Cover slots made from any other picture, including an earlier copy of this one, are
    // cleared; the cover measuring step that follows the seeds rebuilds them from this copy.
    const copyKey = new URL(image).pathname.slice(1);
    await db
      .update(schema.sale)
      .set({
        coverImages: [image],
        coverSlots: sql`case when ${schema.sale.coverSlots}::text like ${`%${copyKey}%`} then ${schema.sale.coverSlots} else '{}'::jsonb end`,
      })
      .where(eq(schema.sale.id, id));
  }

  await writeNotifications(db, now, people.ids, catalogue.lots);
  await writeEnquiries(db, now, people.ids);

  return {
    topUp,
    sales: catalogue.sales.length,
    lots: catalogue.lots.length,
    bids: catalogue.bids.length,
    departments: DEPARTMENTS.length,
  };
}

/**
 * The exposure the approved case covers: the buyer's open invoices, rounded up to the next
 * £1,000 so a small change to the lots does not break the cover.
 */
export function approvedExposurePounds(
  payments: readonly Pick<DemoPayment, "buyerUserId" | "status" | "invoice">[],
  userId: string,
): number {
  const openPence = payments
    .filter((p) => p.buyerUserId === userId && p.status !== "captured")
    .reduce((sum, p) => sum + p.invoice.totalPence, 0);
  return Math.ceil(openPence / 100_000) * 1_000;
}

/**
 * The payer's source of funds is approved, for more than their open invoices add up to, so the
 * check on the amount does not hold their payment.
 */
async function writeApprovedSourceOfFunds(
  db: Db,
  now: number,
  userId: string,
  reviewerUserId: string,
  catalogue: ReturnType<typeof buildFullCatalogue>,
) {
  const exposurePounds = approvedExposurePounds(catalogue.payments, userId);
  await db
    .insert(schema.sourceOfFunds)
    .values({
      id: extraId("dee00000", 1),
      userId,
      status: "approved",
      trigger: "threshold",
      thresholdAmount: "9000.00",
      exposureAmount: exposurePounds.toFixed(2),
      currency: "GBP",
      declaredSource: "Sale of a family property (demo).",
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(now - 2 * DAY),
      reviewNotes: "Documents checked (demo).",
      createdAt: new Date(now - 9 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    })
    .onConflictDoNothing();
}

/** The twelve departments exist, in order, each with a picture of one of its works. */
async function ensureDepartments(db: Db, base: Awaited<ReturnType<typeof loadBase>>) {
  for (const [index, department] of DEPARTMENTS.entries()) {
    const source = departmentHeroSource(department.slug);
    const picture = source ? demoImageUrl(source, "cover") : null;
    if (!base.categoryIdBySlug.has(department.slug)) {
      await db
        .insert(schema.category)
        .values({ name: department.name, slug: department.slug, sortOrder: index })
        .onConflictDoNothing();
    }
    await db
      .update(schema.category)
      .set({ heroImageKey: picture, sortOrder: index, archived: false })
      .where(eq(schema.category.slug, department.slug));
  }
}

type NotificationSpec = {
  type: string;
  user: "collector" | "heldBuyer";
  title: string;
  message: string;
  lot?: { sale: string; title: string };
  hoursAgo: number;
  read: boolean;
};

const NOTIFICATIONS: NotificationSpec[] = [
  {
    type: "outbid",
    user: "collector",
    title: "You have been outbid",
    message: "Another bidder has gone above your bid on Three Dancers Preparing for Class.",
    lot: { sale: "depts", title: WORKS.threeDancers.title },
    hoursAgo: 3,
    read: false,
  },
  {
    type: "watchlist_ending_soon",
    user: "collector",
    title: "A lot you are watching closes soon",
    message: "Mediterranean Sea - Sète closes tomorrow evening.",
    lot: { sale: "depts", title: WORKS.sete.title },
    hoursAgo: 8,
    read: false,
  },
  {
    type: "lot_won",
    user: "collector",
    title: "You won a lot",
    message: "Your bid of £95,000 won Study Sheet with Three Women and a Boy.",
    lot: { sale: "autumnPast", title: WORKS.threeWomen.title },
    hoursAgo: 5 * 24,
    read: true,
  },
  {
    type: "payment_received",
    user: "collector",
    title: "Payment received",
    message: "Thank you. We have received your payment and will arrange delivery.",
    lot: { sale: "autumnPast", title: WORKS.threeWomen.title },
    hoursAgo: 4 * 24,
    read: true,
  },
  {
    type: "lot_shipped",
    user: "collector",
    title: "Your lot is on its way",
    message: "Your purchase has been collected by LAX Fine Art Logistics.",
    lot: { sale: "autumnPast", title: WORKS.hiroshige.title },
    hoursAgo: 24,
    read: false,
  },
  {
    type: "payment_due",
    user: "heldBuyer",
    title: "Your invoice is ready",
    message: "Your invoice for Vase is due in 3 days. Verify your identity so we can release it.",
    lot: { sale: "autumnPast", title: WORKS.chelseaVase.title },
    hoursAgo: 4 * 24,
    read: false,
  },
  {
    type: "kyc_resubmission_required",
    user: "heldBuyer",
    title: "Verify your identity",
    message: "We need to verify your identity before we can release your purchase.",
    hoursAgo: 4 * 24,
    read: false,
  },
];

async function writeNotifications(
  db: Db,
  now: number,
  ids: Record<string, string>,
  lots: { id: string; saleId: string; title: string }[],
) {
  const saleIds: Record<string, string> = {
    depts: DEMO_IDS.sale(11),
    autumnPast: DEMO_IDS.sale(16),
  };
  const rows = NOTIFICATIONS.map((spec, index) => {
    const lot = spec.lot
      ? lots.find((l) => l.saleId === saleIds[spec.lot?.sale ?? ""] && l.title === spec.lot?.title)
      : undefined;
    const userId = spec.user === "collector" ? ids.collector : ids.heldBuyer;
    return {
      id: NOTIFICATION_ID(index + 1),
      userId: userId as string,
      type: spec.type,
      title: spec.title,
      message: spec.message,
      lotId: lot?.id ?? null,
      read: spec.read,
      createdAt: new Date(now - spec.hoursAgo * HOUR),
    };
  });
  await db.insert(schema.notification).values(rows).onConflictDoNothing();
}

async function writeEnquiries(db: Db, now: number, ids: Record<string, string>) {
  await db
    .insert(schema.marketingEnquiry)
    .values([
      {
        id: ENQUIRY_ID(1),
        intent: "private_sale_buy",
        topic: "buying",
        name: "Henrietta Cole",
        email: "henrietta.cole@example.com",
        message:
          "I am looking for a Modern British landscape from the 1950s, budget around £60,000. Could a specialist let me know if anything is available privately?",
        sourcePage: "/private-sales",
        status: "new",
        createdAt: new Date(now - 6 * HOUR),
      },
      {
        id: ENQUIRY_ID(2),
        intent: "private_sale_sell",
        topic: "selling",
        name: "Charlotte Hayes",
        email: DEMO_PEOPLE.collector.email,
        message:
          "I have a small bronze hare, number 3 of 9, that I would prefer to sell privately rather than at auction. Can you advise on the process?",
        sourcePage: "/private-sales",
        userId: ids.collector as string,
        status: "new",
        createdAt: new Date(now - 2 * DAY),
      },
    ])
    .onConflictDoNothing();
}

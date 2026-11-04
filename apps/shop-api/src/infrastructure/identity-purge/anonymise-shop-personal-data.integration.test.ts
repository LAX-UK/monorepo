import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import {
  shopAlertDigest,
  shopAlertMatch,
  shopAlertSubscriber,
  shopAlertTopic,
  shopArtistApplication,
  shopBasket,
  shopIdentitySession,
  shopOrder,
  shopParty,
  shopPartyInvite,
  shopUserProfile,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymiseShopPersonalData } from "./anonymise-shop-personal-data.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

const now = new Date("2026-11-04T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;

describe.skipIf(!ownerUrl || !shopUrl)("anonymise Shop personal data", () => {
  let pool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl || !shopUrl) throw new Error("Integration test database URLs are required");
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    pool = new pg.Pool({ connectionString: shopUrl });
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await pool.end();
  });

  const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function fixture() {
    const id = suffix();
    const db = createDbFromPool(pool);
    const subject = `purge-subject-${id}`;
    const other = `purge-other-${id}`;
    const seed = async (subjectId: string) => {
      await db
        .insert(shopUserProfile)
        .values({ identitySubjectId: subjectId, email: `${subjectId}@example.test`, name: "Ada" });
      const [party] = await db
        .insert(shopParty)
        .values({ displayName: "Ada Lovelace", identitySubjectId: subjectId })
        .returning({ id: shopParty.id });
      const [order] = await db
        .insert(shopOrder)
        .values({
          identitySubjectId: subjectId,
          buyerPartyId: party?.id,
          status: "paid",
          fulfilment: "uk_insured_delivery",
          merchandiseSubtotalPence: 5000,
          fulfilmentSurchargePence: 500,
          totalPence: 5500,
          idempotencyKey: `purge-${suffix()}`,
          stripePaymentIntentId: `pi_${suffix()}`,
          paidAt: new Date(now.getTime() - HOUR),
          deliveryRecipientName: "Ada Lovelace",
          deliveryLine1: "1 Example Road",
          deliveryCity: "London",
          deliveryPostcode: "N1 1AA",
          deliveryCountry: "GB",
          deliveryPhone: "+447000000000",
        })
        .returning({ id: shopOrder.id });
      await db.insert(shopBasket).values({
        identitySubjectId: subjectId,
        expiresAt: new Date(now.getTime() + HOUR),
      });
      const [alertSubscriber] = await db
        .insert(shopAlertSubscriber)
        .values({
          product: "art",
          email: `${subjectId}@example.test`,
          subjectId,
          status: "confirmed",
          consentText: "Tell me when artists I follow publish",
          consentSource: "test",
          requestedAt: now,
        })
        .returning({ id: shopAlertSubscriber.id });
      const alertId = alertSubscriber?.id as string;
      await db
        .insert(shopAlertTopic)
        .values({ subscriberId: alertId, topic: "art.followed_artists", emailOn: true });
      const [alertDigest] = await db
        .insert(shopAlertDigest)
        .values({
          subscriberId: alertId,
          product: "art",
          localDate: "2026-11-04",
          itemCount: 1,
          outboxIdempotencyKey: `digest-${suffix()}`,
        })
        .returning({ id: shopAlertDigest.id });
      await db.insert(shopAlertMatch).values({
        subscriberId: alertId,
        topic: "art.followed_artists",
        itemKey: `artwork:${suffix()}`,
        snapshot: { title: "Untitled" },
        digestId: alertDigest?.id,
      });
      await db.insert(shopIdentitySession).values({
        id: `session-${suffix()}`,
        subjectId,
        expiresAt: new Date(now.getTime() + HOUR),
      });
      await db.insert(shopArtistApplication).values({
        applicantSubjectId: subjectId,
        status: "declined",
        submittedAt: new Date(now.getTime() - 2 * HOUR),
        decidedAt: now,
        artistName: "Ada",
        contactEmail: `${subjectId}@example.test`,
        statement: "About my work",
        website: "https://ada.example",
        messageToArtist: "Not at this time",
      });
      await db.insert(shopPartyInvite).values({
        partyId: party?.id as string,
        email: `${subjectId}@example.test`,
        tokenHash: `hash-${suffix()}`,
        expiresAt: new Date(now.getTime() + HOUR),
      });
      return { partyId: party?.id as string, orderId: order?.id as string, alertId };
    };
    return { db, subject, other, seed };
  }

  it("clears a person's personal data, keeps the financial record and leaves others alone", async () => {
    const { db, subject, other, seed } = await fixture();
    const { orderId, alertId } = await seed(subject);
    const untouched = await seed(other);

    const counts = await anonymiseShopPersonalData(db, subject, now);

    expect(counts).toMatchObject({
      shop_user_profile: 1,
      shop_party: 1,
      shop_order: 1,
      shop_basket: 1,
      shop_alert_subscriber: 1,
      shop_identity_session: 1,
      shop_artist_application: 1,
      shop_party_invite: 1,
    });

    const [profile] = await db
      .select()
      .from(shopUserProfile)
      .where(eq(shopUserProfile.identitySubjectId, subject));
    expect(profile?.email).toBeNull();
    expect(profile?.name).toMatch(/^Deleted user /);

    const [order] = await db.select().from(shopOrder).where(eq(shopOrder.id, orderId));
    expect(order).toMatchObject({
      totalPence: 5500,
      status: "paid",
      deliveryPhone: null,
      deliveryLine1: "1 Example Road",
      personalDataErasedAt: now,
    });
    expect(order?.stripePaymentIntentId).toMatch(/^pi_/);

    const [application] = await db
      .select()
      .from(shopArtistApplication)
      .where(eq(shopArtistApplication.applicantSubjectId, subject));
    expect(application).toMatchObject({
      status: "declined",
      artistName: null,
      contactEmail: null,
      statement: null,
      website: null,
      messageToArtist: null,
      socialLinks: [],
    });

    for (const [table, column] of [
      [shopBasket, shopBasket.identitySubjectId],
      [shopAlertSubscriber, shopAlertSubscriber.subjectId],
      [shopIdentitySession, shopIdentitySession.subjectId],
    ] as const) {
      expect(await db.select().from(table).where(eq(column, subject))).toHaveLength(0);
      expect(await db.select().from(table).where(eq(column, other))).toHaveLength(1);
    }
    // Topics, matches and digests go with the subscriber; the other person's remain.
    for (const table of [shopAlertTopic, shopAlertMatch, shopAlertDigest]) {
      expect(await db.select().from(table).where(eq(table.subscriberId, alertId))).toHaveLength(0);
      expect(
        await db.select().from(table).where(eq(table.subscriberId, untouched.alertId)),
      ).toHaveLength(1);
    }
    expect(
      await db.select().from(shopPartyInvite).where(eq(shopPartyInvite.partyId, untouched.partyId)),
    ).toHaveLength(1);
    const [otherOrder] = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, untouched.orderId));
    expect(otherOrder?.deliveryPhone).toBe("+447000000000");
  });

  it("finds nothing left to delete or clear the second time", async () => {
    const { db, subject, seed } = await fixture();
    await seed(subject);
    await anonymiseShopPersonalData(db, subject, now);
    const again = await anonymiseShopPersonalData(db, subject, new Date(now.getTime() + HOUR));
    for (const table of [
      "shop_basket",
      "shop_alert_subscriber",
      "shop_identity_session",
      "shop_party_invite",
      "shop_artist_application",
    ]) {
      expect(again).not.toHaveProperty(table);
    }
  });
});

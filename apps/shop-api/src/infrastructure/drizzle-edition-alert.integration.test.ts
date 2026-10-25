import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import {
  domainEvent,
  emailOutbox,
  shopArtworkInterest,
  shopEdition,
  shopUserProfile,
} from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEditionAlertHandlers } from "../application/handlers/edition-alerts.handler.js";
import { createPublishedArtworkImportWriter } from "../test-support/shop-fixtures.js";
import { createDrizzleArtworkInterestRepository } from "./drizzle-artwork-interest.repository.js";
import { createDrizzleEditionAlertStore } from "./drizzle-edition-alert.store.js";
import { createDrizzleSaleAuthorityWriter } from "./drizzle-sale-authority.writer.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import { dispatchShopNotifyMeEmails } from "./shop-notify-me-dispatch.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;
const ORIGINS = { shop: "http://localhost:3020", art: "http://localhost:3050" };

describe.skipIf(!ownerUrl || !shopUrl)("drizzle edition alert store", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl || !shopUrl) throw new Error("Integration test database URLs are required");
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  function setup() {
    const db = createDbFromPool(shopPool);
    const store = createDrizzleEditionAlertStore(db, { domainEventMode: "off" });
    const alerts = createEditionAlertHandlers({
      artworks: createDrizzleArtworkInterestRepository(db),
      alerts: store,
    });
    return { db, store, alerts };
  }

  /** A published edition with nothing authorised for sale, which reads as sold out. */
  async function soldOutEdition(db: ReturnType<typeof createDbFromPool>, key: string) {
    const imported = await createPublishedArtworkImportWriter(db).importArtwork({
      importKey: `integration:alert:${key}`,
      slug: `integration-alert-${key}`,
      title: `Alert ${key}`,
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-alert-artist-${key}`,
      artistDisplayName: "Alert Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });
    return { artworkId: imported.artworkId, slug: `integration-alert-${key}` };
  }

  /** Authorises one LAX-owned edition of the artwork for sale. */
  async function restock(db: ReturnType<typeof createDbFromPool>, artworkId: string) {
    const [edition] = await db
      .select({ ownerPartyId: shopEdition.ownerPartyId })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.allocation, "lax")))
      .limit(1);
    if (!edition?.ownerPartyId) throw new Error("fixture edition missing");
    await createDrizzleSaleAuthorityWriter(db, "off").grantSaleAuthority({
      artworkId,
      ownerPartyId: edition.ownerPartyId,
      authorisedCount: 1,
      evidenceNote: "edition alert fixture",
      recordedBySubjectId: "integration-staff",
    });
  }

  it("keeps one waiting alert per address, whatever its case, and records accounts with their email", async () => {
    const { db, alerts } = setup();
    const suffix = `${Date.now()}-a`;
    const artwork = await soldOutEdition(db, suffix);
    const subject = `subject-alert-${suffix}`;
    await db.insert(shopUserProfile).values({
      identitySubjectId: subject,
      email: `Member-${suffix}@Example.com`,
      name: "Alert Member",
    });

    expect(
      await alerts.register({
        artworkSlug: artwork.slug,
        recipient: { kind: "guest", email: ` Guest-${suffix}@Example.com ` },
      }),
    ).toBe("registered");
    expect(
      await alerts.register({
        artworkSlug: artwork.slug,
        recipient: { kind: "guest", email: `guest-${suffix}@example.com` },
      }),
    ).toBe("already_subscribed");
    expect(
      await alerts.register({
        artworkSlug: artwork.slug,
        recipient: { kind: "account", identitySubjectId: subject },
      }),
    ).toBe("registered");
    // The member's address is already waiting through the account.
    expect(
      await alerts.register({
        artworkSlug: artwork.slug,
        recipient: { kind: "guest", email: `member-${suffix}@example.com` },
      }),
    ).toBe("already_subscribed");

    const rows = await db
      .select({
        email: shopArtworkInterest.contactEmail,
        subject: shopArtworkInterest.identitySubjectId,
      })
      .from(shopArtworkInterest)
      .where(eq(shopArtworkInterest.artworkId, artwork.artworkId));
    expect(rows).toEqual(
      expect.arrayContaining([
        { email: `guest-${suffix}@example.com`, subject: null },
        { email: `member-${suffix}@example.com`, subject },
      ]),
    );
    expect(rows).toHaveLength(2);

    const events = await db
      .select({ payload: domainEvent.payload })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateId, artwork.artworkId),
          eq(domainEvent.eventType, "shop.artwork.interest_registered"),
        ),
      );
    // Only the signed-in alert feeds account-keyed consumers.
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({ identitySubjectId: subject, intent: "notify_me" });
  });

  it("refuses an alert for an edition that can be bought", async () => {
    const { db, alerts } = setup();
    const suffix = `${Date.now()}-b`;
    const artwork = await soldOutEdition(db, suffix);
    await restock(db, artwork.artworkId);
    expect(
      await alerts.register({
        artworkSlug: artwork.slug,
        recipient: { kind: "guest", email: `buyer-${suffix}@example.com` },
      }),
    ).toBe("not_subscribable");
  });

  it("lists and stops a member's alerts, including ones made as a guest with the same address", async () => {
    const { db, alerts } = setup();
    const suffix = `${Date.now()}-c`;
    const first = await soldOutEdition(db, `${suffix}-1`);
    const second = await soldOutEdition(db, `${suffix}-2`);
    const subject = `subject-list-${suffix}`;
    await db.insert(shopUserProfile).values({
      identitySubjectId: subject,
      email: `list-${suffix}@example.com`,
      name: "List Member",
    });
    await alerts.register({
      artworkSlug: first.slug,
      recipient: { kind: "guest", email: `list-${suffix}@example.com` },
    });
    await alerts.register({
      artworkSlug: second.slug,
      recipient: { kind: "account", identitySubjectId: subject },
    });

    const listed = await alerts.listForSubject(subject);
    expect(listed.map((alert) => alert.artworkSlug).sort()).toEqual(
      [first.slug, second.slug].sort(),
    );
    expect(listed[0]?.artistName).toBe("Alert Artist");

    const guestMade = listed.find((alert) => alert.artworkSlug === first.slug);
    if (!guestMade) throw new Error("guest alert missing");
    expect(
      await alerts.cancelForSubject({
        identitySubjectId: subject,
        target: { alertId: guestMade.id },
      }),
    ).toBe("cancelled");
    expect(
      await alerts.cancelForSubject({
        identitySubjectId: subject,
        target: { alertId: guestMade.id },
      }),
    ).toBe("already_stopped");
    expect(
      await alerts.cancelForSubject({
        identitySubjectId: `someone-else-${suffix}`,
        target: { alertId: guestMade.id },
      }),
    ).toBe("not_found");
    expect(
      await alerts.cancelForSubject({
        identitySubjectId: subject,
        target: { artworkSlug: second.slug },
      }),
    ).toBe("cancelled");
    expect(await alerts.listForSubject(subject)).toEqual([]);

    // A stopped alert can be asked for again.
    expect(
      await alerts.register({
        artworkSlug: first.slug,
        recipient: { kind: "account", identitySubjectId: subject },
      }),
    ).toBe("registered");
  });

  it("emails restocked editions first, with a token that stops every waiting alert for the address", async () => {
    const { db, alerts } = setup();
    const suffix = `${Date.now()}-d`;
    const email = `dispatch-${suffix}@example.com`;
    const back = await soldOutEdition(db, `${suffix}-back`);
    const stillOut = await soldOutEdition(db, `${suffix}-out`);
    const stopped = await soldOutEdition(db, `${suffix}-stopped`);
    for (const artwork of [back, stillOut, stopped]) {
      await alerts.register({ artworkSlug: artwork.slug, recipient: { kind: "guest", email } });
    }
    await db
      .update(shopArtworkInterest)
      .set({ cancelledAt: new Date() })
      .where(eq(shopArtworkInterest.artworkId, stopped.artworkId));
    await restock(db, back.artworkId);
    await restock(db, stopped.artworkId);

    const notifications = createDrizzleShopNotificationPublisher();
    await dispatchShopNotifyMeEmails(db, {
      notifications,
      storefrontOrigins: ORIGINS,
      now: new Date(),
    });

    const sentRows = await db
      .select({ id: shopArtworkInterest.id, artworkId: shopArtworkInterest.artworkId })
      .from(shopArtworkInterest)
      .where(
        and(
          eq(shopArtworkInterest.contactEmail, email),
          eq(shopArtworkInterest.intent, "notify_me"),
        ),
      );
    const outbox = await db
      .select({
        key: emailOutbox.idempotencyKey,
        vars: emailOutbox.vars,
        to: emailOutbox.toSnapshot,
      })
      .from(emailOutbox)
      .where(
        eq(
          emailOutbox.idempotencyKey,
          `edition-available:${sentRows.find((row) => row.artworkId === back.artworkId)?.id}`,
        ),
      );
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe(email);
    for (const row of sentRows.filter((r) => r.artworkId !== back.artworkId)) {
      const none = await db
        .select({ key: emailOutbox.idempotencyKey })
        .from(emailOutbox)
        .where(eq(emailOutbox.idempotencyKey, `edition-available:${row.id}`));
      expect(none).toEqual([]);
    }

    const url = new URL((outbox[0]?.vars as { unsubscribeUrl: string }).unsubscribeUrl);
    const token = url.searchParams.get("token") ?? "";
    expect(await alerts.previewUnsubscribe(token)).toEqual({
      maskedEmail: "d•••@example.com",
      artworkTitle: `Alert ${suffix}-back`,
      waitingCount: 1,
    });
    expect(await alerts.unsubscribe(token)).toEqual({ stopped: 1 });
    expect(await alerts.unsubscribe(token)).toEqual({ stopped: 0 });
    expect(await alerts.previewUnsubscribe("b".repeat(43))).toBeNull();
    expect(await alerts.unsubscribe("b".repeat(43))).toBeNull();
  });
});

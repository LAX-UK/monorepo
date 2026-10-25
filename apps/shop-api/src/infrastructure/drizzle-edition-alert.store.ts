import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopArtworkInterest, shopParty } from "@auction/db/schema";
import { type SQL, and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { maskAlertEmail, normalizeAlertEmail } from "../application/edition-alert-email.js";
import type {
  EditionAlertRecipient,
  EditionAlertStore,
} from "../application/ports/edition-alert.store.js";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";
import { hashEditionAlertToken } from "./edition-alert-token.js";
import { resolveShopUserEmail } from "./resolve-shop-user-email.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "./shop-domain-event-publisher.js";

type EditionAlertStoreOptions = {
  resolveMediaUrl?: (value: string | null | undefined) => string | null;
  domainEventMode?: ShopDomainEventPublisherMode;
};

/** The person an alert belongs to: an account, an address, or both. */
type AlertOwner = { identitySubjectId: string | null; email: string | null };

const waitingAlert = and(
  eq(shopArtworkInterest.intent, "notify_me"),
  isNull(shopArtworkInterest.notifiedAt),
  isNull(shopArtworkInterest.cancelledAt),
) as SQL;

function ownedBy(owner: AlertOwner): SQL | null {
  const parts: SQL[] = [];
  if (owner.identitySubjectId) {
    parts.push(eq(shopArtworkInterest.identitySubjectId, owner.identitySubjectId));
  }
  if (owner.email) {
    parts.push(sql`lower(${shopArtworkInterest.contactEmail}) = ${owner.email}`);
  }
  if (parts.length === 0) return null;
  return parts.length === 1 ? (parts[0] as SQL) : (or(...parts) as SQL);
}

async function accountEmail(db: Database, identitySubjectId: string): Promise<string | null> {
  const email = await resolveShopUserEmail(db, identitySubjectId);
  return email ? normalizeAlertEmail(email) : null;
}

export function createDrizzleEditionAlertStore(
  db: Database,
  options: EditionAlertStoreOptions = {},
): EditionAlertStore {
  const resolveMediaUrl = options.resolveMediaUrl ?? ((value) => value ?? null);
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");

  async function ownerForSubject(identitySubjectId: string): Promise<AlertOwner> {
    return { identitySubjectId, email: await accountEmail(db, identitySubjectId) };
  }

  /** The alert a token was minted for, and the person it belongs to. */
  async function ownerForToken(
    token: string,
  ): Promise<{ owner: AlertOwner; artworkTitle: string } | null> {
    const [row] = await db
      .select({
        identitySubjectId: shopArtworkInterest.identitySubjectId,
        contactEmail: shopArtworkInterest.contactEmail,
        artworkTitle: shopArtwork.title,
      })
      .from(shopArtworkInterest)
      .innerJoin(shopArtwork, eq(shopArtworkInterest.artworkId, shopArtwork.id))
      .where(
        and(
          eq(shopArtworkInterest.unsubscribeTokenHash, hashEditionAlertToken(token)),
          eq(shopArtworkInterest.intent, "notify_me"),
        ),
      )
      .limit(1);
    if (!row) return null;
    const email = row.contactEmail
      ? normalizeAlertEmail(row.contactEmail)
      : row.identitySubjectId
        ? await accountEmail(db, row.identitySubjectId)
        : null;
    return {
      owner: { identitySubjectId: row.identitySubjectId, email },
      artworkTitle: row.artworkTitle,
    };
  }

  async function stopWaiting(owner: AlertOwner, now: Date, extra?: SQL): Promise<number> {
    const owned = ownedBy(owner);
    if (!owned) return 0;
    const stopped = await db
      .update(shopArtworkInterest)
      .set({ cancelledAt: now, updatedAt: now })
      .where(and(waitingAlert, owned, ...(extra ? [extra] : [])))
      .returning({ id: shopArtworkInterest.id });
    return stopped.length;
  }

  return {
    async registerAlert({
      artworkId,
      recipient,
    }: { artworkId: string; recipient: EditionAlertRecipient }) {
      const identitySubjectId = recipient.kind === "account" ? recipient.identitySubjectId : null;
      const email =
        recipient.kind === "guest"
          ? normalizeAlertEmail(recipient.email)
          : await accountEmail(db, recipient.identitySubjectId);
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(shopArtworkInterest)
          .values({ artworkId, intent: "notify_me", identitySubjectId, contactEmail: email })
          // The partial unique indexes keep one waiting alert per artwork for an account and for
          // an address, so a repeat request is a no-op.
          .onConflictDoNothing()
          .returning({ id: shopArtworkInterest.id });
        if (inserted.length === 0) return "already_subscribed" as const;
        // Account-keyed consumers (CRM deals) only follow signed-in interest.
        if (identitySubjectId) {
          await events.insertInTransaction(tx as Database, {
            aggregateType: "shop_artwork",
            aggregateId: artworkId,
            eventType: "shop.artwork.interest_registered",
            producer: "shop-api",
            payload: { schemaVersion: 1, artworkId, identitySubjectId, intent: "notify_me" },
          });
        }
        return "registered" as const;
      });
    },

    async listWaitingForSubject(identitySubjectId) {
      const owned = ownedBy(await ownerForSubject(identitySubjectId));
      if (!owned) return [];
      const rows = await db
        .select({
          id: shopArtworkInterest.id,
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          artistName: shopParty.displayName,
          imageUrl: shopArtwork.primaryImageUrl,
          createdAt: shopArtworkInterest.createdAt,
        })
        .from(shopArtworkInterest)
        .innerJoin(shopArtwork, eq(shopArtworkInterest.artworkId, shopArtwork.id))
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(and(waitingAlert, owned, publicArtworkVisible()))
        .orderBy(desc(shopArtworkInterest.createdAt), desc(shopArtworkInterest.id))
        .limit(100);
      return rows.map((row) => ({ ...row, imageUrl: resolveMediaUrl(row.imageUrl) }));
    },

    async cancelForSubject({ identitySubjectId, target, now }) {
      const owner = await ownerForSubject(identitySubjectId);
      const owned = ownedBy(owner);
      if (!owned) return "not_found";
      if ("alertId" in target) {
        const [row] = await db
          .select({ id: shopArtworkInterest.id })
          .from(shopArtworkInterest)
          .where(
            and(
              eq(shopArtworkInterest.id, target.alertId),
              eq(shopArtworkInterest.intent, "notify_me"),
              owned,
            ),
          )
          .limit(1);
        if (!row) return "not_found";
        const stopped = await stopWaiting(owner, now, eq(shopArtworkInterest.id, row.id));
        return stopped > 0 ? "cancelled" : "already_stopped";
      }
      const artworkIds = db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.slug, target.artworkSlug));
      const stopped = await stopWaiting(
        owner,
        now,
        inArray(shopArtworkInterest.artworkId, artworkIds),
      );
      return stopped > 0 ? "cancelled" : "already_stopped";
    },

    async previewUnsubscribe(token) {
      const found = await ownerForToken(token);
      if (!found?.owner.email) return null;
      const owned = ownedBy(found.owner);
      const [waiting] = owned
        ? await db
            .select({ total: count() })
            .from(shopArtworkInterest)
            .where(and(waitingAlert, owned))
        : [{ total: 0 }];
      return {
        maskedEmail: maskAlertEmail(found.owner.email),
        artworkTitle: found.artworkTitle,
        waitingCount: Number(waiting?.total ?? 0),
      };
    },

    async unsubscribe(token, now) {
      const found = await ownerForToken(token);
      if (!found) return null;
      return { stopped: await stopWaiting(found.owner, now) };
    },
  };
}

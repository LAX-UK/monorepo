import type { Database } from "@auction/db";
import {
  shopArtistApplication,
  shopArtworkInterest,
  shopBasket,
  shopFollowedArtist,
  shopGeneralEnquiry,
  shopGuestCustomer,
  shopGuestOrderLink,
  shopIdentitySession,
  shopOrder,
  shopParty,
  shopPartyInvite,
  shopReleaseAlertSubscription,
  shopSavedArtwork,
  shopUserProfile,
} from "@auction/db/schema";
import { ERASED_ENQUIRY_MESSAGE } from "@auction/shop-domain";
import { and, inArray, ne, or, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { DrizzleShopAlertSubscriberErasure } from "../alerts/drizzle-shop-alert-subscriber-erasure.js";

/**
 * What Shop does with a person's data when Identity purges their account. This file is the single
 * list: every table that holds personal data appears here with its treatment and the fields it
 * touches.
 *
 * Treatments
 * - delete: the rows only describe the person (saved works, followed artists, guest order links).
 * - scrub: the row stays because orders or staff history point at it, with the personal fields
 *   nulled or replaced by the person's pseudonym.
 *
 * Also deleted: the basket (its lines go with it), release alert subscriptions and alert sign-ups (Shop releases and lax.art followed artists, with their topics, matches and digests), invitations sent to
 * the person's parties and their login sessions. An artist application keeps its reference, status,
 * dates and (when accepted) the artist name that is public anyway; the contact and portfolio text is
 * cleared. Its event history is append-only staff history that holds no contact details, and stays.
 *
 * Kept on purpose: orders, order lines, payments, refunds, invoice numbers, VAT and amounts, and
 * the buyer name and address printed on the invoice. The invoice name and address are cleared by
 * the existing retention purge once the accounting retention has passed; marking the order erased
 * (`personal_data_erased_at`) hands it to that purge, exactly as for an erased guest. The phone is
 * not on the invoice and goes now.
 */

export type ShopAnonymisationScope = {
  /** The purged person. */
  subjectId: string;
  /** The purged subject and every retired alias that was merged into it. */
  subjectIds: readonly string[];
  pseudonym: string;
  now: Date;
};

export type ShopAnonymisationRule = {
  /** The table name recorded in the audit event. */
  table: string;
  treatment: "delete" | "scrub";
  /** Fields changed by a scrub; empty for a delete. Documentation and test oracle. */
  fields: readonly string[];
  /**
   * Returns the number of rows changed, or, when one rule touches several tables, the rows changed
   * per table name.
   */
  apply(tx: Database, scope: ShopAnonymisationScope): Promise<number | Record<string, number>>;
};

function deleteBySubject(name: string, table: PgTable, column: AnyPgColumn): ShopAnonymisationRule {
  return {
    table: name,
    treatment: "delete",
    fields: [],
    async apply(tx, scope) {
      const removed = await tx
        .delete(table)
        .where(inArray(column, [...scope.subjectIds]))
        .returning();
      return removed.length;
    },
  };
}

const alertErasure = new DrizzleShopAlertSubscriberErasure();

const EMPTY_JSON_LIST = sql`'[]'::jsonb`;

export const SHOP_ANONYMISATION_RULES: readonly ShopAnonymisationRule[] = [
  {
    table: "shop_user_profile",
    treatment: "scrub",
    fields: ["email", "name"],
    async apply(tx, scope) {
      const rows = await tx
        .update(shopUserProfile)
        .set({ email: null, name: scope.pseudonym, updatedAt: scope.now })
        .where(inArray(shopUserProfile.identitySubjectId, [...scope.subjectIds]))
        .returning({ id: shopUserProfile.identitySubjectId });
      return rows.length;
    },
  },
  {
    table: "shop_party",
    treatment: "scrub",
    fields: ["display_name"],
    async apply(tx, scope) {
      const rows = await tx
        .update(shopParty)
        .set({ displayName: scope.pseudonym })
        .where(inArray(shopParty.identitySubjectId, [...scope.subjectIds]))
        .returning({ id: shopParty.id });
      return rows.length;
    },
  },
  {
    table: "shop_order",
    treatment: "scrub",
    fields: ["delivery_phone", "personal_data_erased_at"],
    async apply(tx, scope) {
      const rows = await tx
        .update(shopOrder)
        .set({
          deliveryPhone: null,
          personalDataErasedAt: sql`coalesce(${shopOrder.personalDataErasedAt}, ${scope.now})`,
          updatedAt: scope.now,
        })
        .where(inArray(shopOrder.identitySubjectId, [...scope.subjectIds]))
        .returning({ id: shopOrder.id });
      return rows.length;
    },
  },
  {
    table: "shop_guest_order_link",
    treatment: "delete",
    fields: [],
    async apply(tx, scope) {
      const orders = tx
        .select({ id: shopOrder.id })
        .from(shopOrder)
        .where(inArray(shopOrder.identitySubjectId, [...scope.subjectIds]));
      const removed = await tx
        .delete(shopGuestOrderLink)
        .where(inArray(shopGuestOrderLink.orderId, orders))
        .returning({ tokenHash: shopGuestOrderLink.tokenHash });
      return removed.length;
    },
  },
  {
    table: "shop_guest_customer",
    treatment: "scrub",
    fields: ["email", "name", "phone", "marketing_consent*", "erased_at", "erased_by_subject_id"],
    async apply(tx, scope) {
      // Guests whose orders this account took over: their contact details are the person's own.
      const rows = await tx
        .update(shopGuestCustomer)
        .set({
          email: sql`'erased:' || ${shopGuestCustomer.id}::text`,
          name: null,
          phone: null,
          marketingConsent: false,
          marketingConsentAt: null,
          marketingConsentVersion: null,
          erasedAt: sql`coalesce(${shopGuestCustomer.erasedAt}, ${scope.now})`,
          erasedBySubjectId: sql`coalesce(${shopGuestCustomer.erasedBySubjectId}, ${scope.subjectId})`,
          updatedAt: scope.now,
        })
        .where(inArray(shopGuestCustomer.claimedSubjectId, [...scope.subjectIds]))
        .returning({ id: shopGuestCustomer.id });
      return rows.length;
    },
  },
  {
    table: "shop_artwork_interest",
    treatment: "scrub",
    fields: [
      "contact_name",
      "contact_phone",
      "contact_email",
      "message",
      "cancelled_at",
      "unsubscribe_token_hash",
    ],
    async apply(tx, scope) {
      // Enquiries keep a marker where the message was; alerts are stopped so none is sent later.
      const rows = await tx
        .update(shopArtworkInterest)
        .set({
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          message: sql`CASE WHEN ${shopArtworkInterest.intent} = 'enquiry' THEN ${ERASED_ENQUIRY_MESSAGE} ELSE NULL END`,
          cancelledAt: sql`CASE WHEN ${shopArtworkInterest.intent} = 'notify_me' THEN coalesce(${shopArtworkInterest.cancelledAt}, ${scope.now}) ELSE NULL END`,
          unsubscribeTokenHash: null,
          updatedAt: scope.now,
        })
        .where(inArray(shopArtworkInterest.identitySubjectId, [...scope.subjectIds]))
        .returning({ id: shopArtworkInterest.id });
      return rows.length;
    },
  },
  {
    table: "shop_general_enquiry",
    treatment: "scrub",
    fields: ["contact_name", "contact_email", "phone", "message"],
    async apply(tx, scope) {
      const rows = await tx
        .update(shopGeneralEnquiry)
        .set({
          contactName: null,
          contactEmail: null,
          phone: null,
          message: ERASED_ENQUIRY_MESSAGE,
          updatedAt: scope.now,
        })
        .where(inArray(shopGeneralEnquiry.identitySubjectId, [...scope.subjectIds]))
        .returning({ id: shopGeneralEnquiry.id });
      return rows.length;
    },
  },
  {
    table: "shop_artist_application",
    treatment: "scrub",
    fields: [
      "contact_email",
      "location",
      "website",
      "social_links",
      "short_bio",
      "statement",
      "representation",
      "exhibitions",
      "message_to_artist",
      "artist_name*",
    ],
    async apply(tx, scope) {
      // An accepted application keeps the artist name, which is the public artist profile's name.
      const rows = await tx
        .update(shopArtistApplication)
        .set({
          contactEmail: null,
          location: null,
          website: null,
          socialLinks: EMPTY_JSON_LIST,
          shortBio: null,
          statement: null,
          representation: null,
          exhibitions: null,
          messageToArtist: null,
          artistName: sql`CASE WHEN ${shopArtistApplication.status} = 'accepted' THEN ${shopArtistApplication.artistName} ELSE NULL END`,
          updatedAt: scope.now,
        })
        .where(
          and(
            inArray(shopArtistApplication.applicantSubjectId, [...scope.subjectIds]),
            // Only rows that still hold something, so a repeat run changes nothing.
            or(
              sql`${shopArtistApplication.contactEmail} IS NOT NULL`,
              sql`${shopArtistApplication.statement} IS NOT NULL`,
              sql`${shopArtistApplication.shortBio} IS NOT NULL`,
              sql`${shopArtistApplication.website} IS NOT NULL`,
              sql`${shopArtistApplication.location} IS NOT NULL`,
              sql`${shopArtistApplication.representation} IS NOT NULL`,
              sql`${shopArtistApplication.exhibitions} IS NOT NULL`,
              sql`${shopArtistApplication.messageToArtist} IS NOT NULL`,
              sql`${shopArtistApplication.socialLinks} <> '[]'::jsonb`,
              and(
                ne(shopArtistApplication.status, "accepted"),
                sql`${shopArtistApplication.artistName} IS NOT NULL`,
              ),
            ),
          ),
        )
        .returning({ id: shopArtistApplication.id });
      return rows.length;
    },
  },
  {
    table: "shop_party_invite",
    treatment: "delete",
    fields: [],
    async apply(tx, scope) {
      const parties = tx
        .select({ id: shopParty.id })
        .from(shopParty)
        .where(inArray(shopParty.identitySubjectId, [...scope.subjectIds]));
      const removed = await tx
        .delete(shopPartyInvite)
        .where(
          or(
            inArray(shopPartyInvite.partyId, parties),
            inArray(shopPartyInvite.acceptedSubjectId, [...scope.subjectIds]),
          ),
        )
        .returning({ id: shopPartyInvite.id });
      return removed.length;
    },
  },
  // Basket lines are removed by the basket's cascade; the count is the baskets.
  deleteBySubject("shop_basket", shopBasket, shopBasket.identitySubjectId),
  deleteBySubject(
    "shop_release_alert_subscription",
    shopReleaseAlertSubscription,
    shopReleaseAlertSubscription.identitySubjectId,
  ),
  deleteBySubject("shop_identity_session", shopIdentitySession, shopIdentitySession.subjectId),
  deleteBySubject("shop_saved_artwork", shopSavedArtwork, shopSavedArtwork.identitySubjectId),
  deleteBySubject("shop_followed_artist", shopFollowedArtist, shopFollowedArtist.identitySubjectId),
  // Alert sign-ups (Shop releases, back in stock, lax.art followed artists) hold the person's
  // address and consent record; topics, matches and digests go with the row by cascade. The
  // release list the engine replaced is cleared above until its table is dropped.
  // The address the account's rows hold is erased too, so an email-only row for it goes with them;
  // a subscriber stopped by a complaint is kept as a suppression, detached from the account.
  {
    table: "shop_alert_subscriber",
    treatment: "delete",
    fields: [],
    async apply(tx, scope) {
      const counts = await alertErasure.erase(tx, { emails: [], subjectIds: scope.subjectIds });
      return {
        shop_alert_subscriber: counts.alertSubscribers,
        shop_release_alert_subscription_by_email: counts.releaseAlerts,
        shop_alert_suppression_kept: counts.suppressionsKept,
      };
    },
  },
];

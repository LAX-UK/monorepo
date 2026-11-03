import type { Database } from "@auction/db";
import {
  shopArtworkInterest,
  shopFollowedArtist,
  shopGeneralEnquiry,
  shopGuestCustomer,
  shopGuestOrderLink,
  shopOrder,
  shopParty,
  shopSavedArtwork,
  shopUserProfile,
} from "@auction/db/schema";
import { ERASED_ENQUIRY_MESSAGE } from "@auction/shop-domain";
import { inArray, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

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
  /** Returns the number of rows changed. */
  apply(tx: Database, scope: ShopAnonymisationScope): Promise<number>;
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
  deleteBySubject("shop_saved_artwork", shopSavedArtwork, shopSavedArtwork.identitySubjectId),
  deleteBySubject("shop_followed_artist", shopFollowedArtist, shopFollowedArtist.identitySubjectId),
];

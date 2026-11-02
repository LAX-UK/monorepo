import {
  artistWatchlist,
  bidUserProfile,
  legalEntity,
  legalEntityAddress,
  legalEntityContactDetails,
  legalEntityInvoiceDetails,
  marketingClickIds,
  notificationAccountMute,
  notificationPreference,
  pushSubscription,
  saleFollow,
  savedSearch,
  telephoneBidBooking,
  userAddress,
  userCategoryInterest,
  userUiPreference,
  watchlist,
} from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";

/**
 * What Bid does with a person's data when Identity purges their account. This file is the single
 * list: every table that holds personal data appears here with its treatment, and each treatment
 * says which fields it touches.
 *
 * Treatments
 * - delete: the rows only describe the person (address book, alerts, preferences) and are removed.
 * - scrub: the row stays because other records point at it, with the personal fields nulled or
 *   replaced by the person's pseudonym.
 *
 * Kept as they are, on purpose (legal or accounting records, or auction history):
 * bids, absentee bids, sale registrations, lots and sales, payments, payment groups, invoices,
 * payouts and payout lines, VAT and fee records, KYC verifications, AML screening and
 * source-of-funds files (anti-money-laundering rules require keeping them after the relationship
 * ends), consignment agreements, disputes, legal-entity membership, and the domain event log.
 * The Identity `user` row is scrubbed by Identity itself and stays so those records keep resolving.
 */

/** Who is being anonymised, resolved once so every rule works on the same set. */
export type BidAnonymisationScope = {
  /** The purged subject and every retired alias that was merged into it. */
  subjectIds: readonly string[];
  /** Individual legal entities created by the subject (their personal buyer or seller account). */
  personalLegalEntityIds: readonly string[];
  pseudonym: string;
};

export type BidAnonymisationRule = {
  /** The table name recorded in the audit event. */
  table: string;
  treatment: "delete" | "scrub";
  /** Fields changed by a scrub; empty for a delete. Documentation and test oracle. */
  fields: readonly string[];
  /** Returns the number of rows changed. */
  apply(tx: ProjectorDbConnection, scope: BidAnonymisationScope): Promise<number>;
};

async function countDeleted(
  tx: ProjectorDbConnection,
  table: PgTable,
  column: AnyPgColumn,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const removed = await tx
    .delete(table)
    .where(inArray(column, [...ids]))
    .returning();
  return removed.length;
}

function deleteBySubject(table: PgTable, name: string, column: AnyPgColumn): BidAnonymisationRule {
  return {
    table: name,
    treatment: "delete",
    fields: [],
    apply: (tx, scope) => countDeleted(tx, table, column, scope.subjectIds),
  };
}

function deleteByPersonalEntity(
  table: PgTable,
  name: string,
  column: AnyPgColumn,
): BidAnonymisationRule {
  return {
    table: name,
    treatment: "delete",
    fields: [],
    apply: (tx, scope) => countDeleted(tx, table, column, scope.personalLegalEntityIds),
  };
}

export const BID_ANONYMISATION_RULES: readonly BidAnonymisationRule[] = [
  {
    table: "bid_user_profile",
    treatment: "scrub",
    fields: ["first_name", "last_name", "mobile", "mobile_country", "date_of_birth"],
    async apply(tx, scope) {
      const rows = await tx
        .update(bidUserProfile)
        .set({
          firstName: null,
          lastName: null,
          mobile: null,
          mobileCountry: null,
          dateOfBirth: null,
        })
        .where(inArray(bidUserProfile.userId, [...scope.subjectIds]))
        .returning({ id: bidUserProfile.userId });
      return rows.length;
    },
  },
  {
    table: "legal_entity",
    treatment: "scrub",
    fields: ["display_name", "legal_name", "slug", "vat_number"],
    async apply(tx, scope) {
      if (scope.personalLegalEntityIds.length === 0) return 0;
      const rows = await tx
        .update(legalEntity)
        .set({
          displayName: scope.pseudonym,
          legalName: scope.pseudonym,
          slug: null,
          vatNumber: null,
        })
        .where(inArray(legalEntity.id, [...scope.personalLegalEntityIds]))
        .returning({ id: legalEntity.id });
      return rows.length;
    },
  },
  {
    table: "legal_entity_contact_details",
    treatment: "scrub",
    fields: ["email", "phone", "website"],
    async apply(tx, scope) {
      if (scope.personalLegalEntityIds.length === 0) return 0;
      const rows = await tx
        .update(legalEntityContactDetails)
        .set({ email: null, phone: null, website: null })
        .where(inArray(legalEntityContactDetails.legalEntityId, [...scope.personalLegalEntityIds]))
        .returning({ id: legalEntityContactDetails.legalEntityId });
      return rows.length;
    },
  },
  {
    table: "telephone_bid_booking",
    treatment: "scrub",
    fields: ["phone_e164", "buyer_notes"],
    async apply(tx, scope) {
      const rows = await tx
        .update(telephoneBidBooking)
        // The number is required by the schema, so an empty string stands for "no number".
        .set({ phoneE164: "", buyerNotes: null })
        .where(inArray(telephoneBidBooking.userId, [...scope.subjectIds]))
        .returning({ id: telephoneBidBooking.id });
      return rows.length;
    },
  },
  deleteByPersonalEntity(
    legalEntityAddress,
    "legal_entity_address",
    legalEntityAddress.legalEntityId,
  ),
  deleteByPersonalEntity(
    legalEntityInvoiceDetails,
    "legal_entity_invoice_details",
    legalEntityInvoiceDetails.legalEntityId,
  ),
  deleteBySubject(userAddress, "user_address", userAddress.userId),
  deleteBySubject(pushSubscription, "push_subscription", pushSubscription.userId),
  deleteBySubject(savedSearch, "saved_search", savedSearch.userId),
  deleteBySubject(watchlist, "watchlist", watchlist.userId),
  deleteBySubject(saleFollow, "sale_follow", saleFollow.userId),
  deleteBySubject(artistWatchlist, "artist_watchlist", artistWatchlist.userId),
  deleteBySubject(userCategoryInterest, "user_category_interest", userCategoryInterest.userId),
  deleteBySubject(notificationPreference, "notification_preference", notificationPreference.userId),
  deleteBySubject(
    notificationAccountMute,
    "notification_account_mute",
    notificationAccountMute.userId,
  ),
  deleteBySubject(marketingClickIds, "marketing_click_ids", marketingClickIds.userId),
  deleteBySubject(userUiPreference, "user_ui_preference", userUiPreference.userId),
];

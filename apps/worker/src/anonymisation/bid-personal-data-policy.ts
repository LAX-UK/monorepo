import {
  artistWatchlist,
  bidUserProfile,
  collectionBooking,
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
import { anonymiseEnquiries, eraseAlertSubscribers } from "@auction/persistence/lib";
import { and, inArray, isNull, or, sql } from "drizzle-orm";
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
 * Alert subscriptions are deleted by account and by the addresses those rows hold, including a
 * visitor new-sale alert for the same address; a subscriber stopped by a complaint is kept as a
 * suppression, detached from the account.
 *
 * Enquiries the person sent are scrubbed too (see the enquiry rule): the sender details and
 * message are replaced, internal notes are cleared, and their photos and documents are detached
 * and deleted. A converted private sale enquiry belongs to its deal and is held, not changed.
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
  /** Years a private sale's record is kept after the deal ends; the default applies when unset. */
  privateSaleRecordRetentionYears?: number | undefined;
};

export type BidAnonymisationRule = {
  /** The table name recorded in the audit event. */
  table: string;
  treatment: "delete" | "scrub";
  /** Fields changed by a scrub; empty for a delete. Documentation and test oracle. */
  fields: readonly string[];
  /**
   * Returns the number of rows changed, or, when one rule touches several tables, the rows changed
   * per table name.
   */
  apply(
    tx: ProjectorDbConnection,
    scope: BidAnonymisationScope,
  ): Promise<number | Record<string, number>>;
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

const enquiryRule: BidAnonymisationRule = {
  table: "marketing_enquiry",
  treatment: "scrub",
  fields: ["name", "email", "phone", "message", "note_body", "location", "looking_for"],
  async apply(tx, scope) {
    const counts = await anonymiseEnquiries(
      tx as never,
      { kind: "accounts", userIds: scope.subjectIds },
      scope.privateSaleRecordRetentionYears === undefined
        ? {}
        : { retentionYears: scope.privateSaleRecordRetentionYears },
    );
    return {
      marketing_enquiry: counts.enquiries,
      marketing_enquiry_note: counts.notes,
      marketing_enquiry_attachment: counts.attachments,
      marketing_enquiry_held: counts.held,
    };
  },
};

/** What replaces the name of a third party who came to collect for the person. */
const THIRD_PARTY_COLLECTOR_PLACEHOLDER = "Deleted collector";

/**
 * A collection booking is kept (it records who handed which works to whom), but the collector's
 * name, email and company are personal data: the person's own, or a third party they named. They
 * are replaced for every booking the person made, authorised or collected, and for the bookings
 * on their personal account. The ID check type, times and lots stay.
 */
const collectionBookingRule: BidAnonymisationRule = {
  table: "collection_booking",
  treatment: "scrub",
  fields: ["collector_name", "collector_email", "collector_company"],
  async apply(tx, scope) {
    const subjects = [...scope.subjectIds];
    const accounts = [...scope.personalLegalEntityIds];
    const rows = await tx
      .update(collectionBooking)
      .set({
        collectorName: sql`CASE WHEN ${collectionBooking.collectorKind} = 'third_party' THEN ${THIRD_PARTY_COLLECTOR_PLACEHOLDER} ELSE ${scope.pseudonym} END`,
        collectorEmail: null,
        collectorCompany: null,
        personalDetailsErasedAt: new Date(),
      })
      .where(
        and(
          isNull(collectionBooking.personalDetailsErasedAt),
          or(
            inArray(collectionBooking.bookedByUserId, subjects),
            inArray(collectionBooking.collectorUserId, subjects),
            inArray(collectionBooking.authorisedByUserId, subjects),
            accounts.length > 0 ? inArray(collectionBooking.legalEntityId, accounts) : undefined,
          ),
        ),
      )
      .returning({ id: collectionBooking.id });
    return rows.length;
  },
};

const alertSubscribersRule: BidAnonymisationRule = {
  table: "bid_alert_subscriber",
  treatment: "delete",
  fields: [],
  async apply(tx, scope) {
    const counts = await eraseAlertSubscribers(tx as never, {
      emails: [],
      userIds: scope.subjectIds,
    });
    return {
      bid_alert_subscriber: counts.alertSubscribers,
      visitor_sale_alert_subscriber: counts.visitorSaleAlerts,
      bid_alert_suppression_kept: counts.suppressionsKept,
    };
  },
};

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
  collectionBookingRule,
  enquiryRule,
  alertSubscribersRule,
];

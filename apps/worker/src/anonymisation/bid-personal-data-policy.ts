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
import { anonymiseEnquiries, eraseAlertSubscribers } from "@auction/persistence/lib";
import { inArray } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import type { BidAnonymisationScope } from "./bid-anonymisation-scope.js";
import { eraseCollectionBookings } from "./collection-booking-erasure.js";
import { scrubEmailEvents, scrubEmailOutbox } from "./email-outbox-erasure.js";
import { scrubNotificationOutbox } from "./notification-outbox-erasure.js";

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
 * Mail queue and notification rows are kept as the record, with what identifies the recipient removed.
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

export type { BidAnonymisationScope };

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

/**
 * Collection bookings keep the record of a visit, but the collector's details are personal data:
 * the person's own, or a third party they named. A live visit is cancelled first (with an
 * `account_erased` cancellation event); ended visits lose the collector's email and company, and
 * the name too unless works were handed over, in which case the name and ID type are kept for
 * `COLLECTION_HANDOVER_RETENTION_YEARS` and cleared by the retention purge.
 */
const collectionBookingRule: BidAnonymisationRule = {
  table: "collection_booking",
  treatment: "scrub",
  fields: ["collector_name", "collector_email", "collector_company"],
  apply: (tx, scope) => eraseCollectionBookings(tx, scope),
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

/**
 * The mail queue keeps one row per email as the record of delivery, so rows stay. Finished rows
 * of the person lose what identifies the recipient: an address in the idempotency key (collection
 * emails and the organisation notice before keys were made from an id or a hash), the recipient
 * snapshot, the message variables (names, addresses, calendar entries) and the provider's error
 * text. That covers the person's own rows, mail with no account sent to an address their rows
 * were sent to, and collection emails to a collector their bookings named. Their queued mail is
 * stopped, except the confirmation of the erasure. Must run before the collection booking rule,
 * which clears the collector address this rule matches on.
 */
const emailOutboxRule: BidAnonymisationRule = {
  table: "email_outbox",
  treatment: "scrub",
  fields: [
    "idempotency_key",
    "to_snapshot",
    "to_snapshot_purge_at",
    "vars",
    "last_error",
    "status",
  ],
  apply: (tx, scope) => scrubEmailOutbox(tx, scope),
};

/** The provider's delivery reports for those messages quote the recipient and bounce text. */
const emailEventRule: BidAnonymisationRule = {
  table: "email_event",
  treatment: "scrub",
  fields: ["payload"],
  apply: (tx, scope) => scrubEmailEvents(tx, scope),
};

/** Dispatched notifications keep their row but not the message, which names other people. */
const notificationOutboxRule: BidAnonymisationRule = {
  table: "notification_outbox",
  treatment: "scrub",
  fields: ["payload", "last_error"],
  apply: (tx, scope) => scrubNotificationOutbox(tx, scope),
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
  emailOutboxRule,
  emailEventRule,
  notificationOutboxRule,
  collectionBookingRule,
  enquiryRule,
  alertSubscribersRule,
];

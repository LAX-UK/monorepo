/** Keys that are treated as non-PII references when no explicit exception path matches. */
const SAFE_LEAF_KEY = /^[a-z][a-zA-Z0-9]*$/;

export function isLikelyReferenceKey(segment: string): boolean {
  if (segment === "schemaVersion" || segment === "source" || segment === "currency") return true;
  if (segment.endsWith("Id")) return true;
  if (segment.endsWith("_id")) return true;
  if (segment.endsWith("At")) return true;
  if (segment === "amount" || segment === "amountCents" || segment === "grossAmount") return true;
  if (segment === "platformFee" || segment === "stripeFee" || segment === "netAmount") return true;
  if (segment === "status" || segment === "kind" || segment === "count") return true;
  if (segment === "paymentLineCount" || segment === "stripeIntentId") return true;
  if (segment === "stripePaymentIntentId" || segment === "stripeTransferId") return true;
  if (segment === "xeroBillId") return true;
  return SAFE_LEAF_KEY.test(segment) && (segment.includes("Cents") || segment.includes("Rate"));
}

/** Exact dot-paths (from JSON root) allowed to retain PII for specific event types. */
export const EXCEPTION_PATHS: Record<string, Set<string>> = {
  "legal_entity.member_invited": new Set(["email", "inviteeEmail", "invitedEmail"]),
  "payment.captured": new Set([
    "buyerName",
    "buyerEmail",
    "buyer.name",
    "buyer.email",
    "email",
    "name",
  ]),
  "kyc.verified": new Set([
    "firstName",
    "lastName",
    "dateOfBirth",
    "verified.firstName",
    "verified.lastName",
    "verified.dateOfBirth",
    "verified.fullName",
    "verified.nationality",
    "verified.documentType",
    "verified.documentCountry",
    "verified.documentExpiry",
  ]),
  /** entity display snapshot is operational; user id is reference-only. */
  "admin.impersonation_started": new Set([
    "impersonating_user_id",
    "target_legal_entity_display_name",
    "session_id",
    "expires_at",
  ]),
  // end_reason values include: manual | timeout | session_replaced | cookie_cleared_after_failed_end | timeout_swept
  "admin.impersonation_ended": new Set(["session_id", "end_reason"]),
  /** admin KYB lifecycle — one event_type per transition; `reason` nullable when not required. */
  "legal_entity.docs_requested": new Set(["from_status", "to_status", "reason"]),
  "legal_entity.review_started": new Set(["from_status", "to_status", "reason"]),
  "legal_entity.approved": new Set(["from_status", "to_status", "reason"]),
  "legal_entity.restricted": new Set(["from_status", "to_status", "reason"]),
  "legal_entity.restriction_lifted": new Set(["from_status", "to_status", "reason"]),
  "legal_entity.rejected": new Set(["from_status", "to_status", "reason"]),
  "legal_entity.archived": new Set(["from_status", "to_status", "reason"]),
  /** Stripe transfer initiation success — all fields are safe operational data. */
  "payout.transfer_initiated": new Set([
    "stripeTransferId",
    "amountCents",
    "currency",
    "stripeConnectAccountId",
    "adopted",
    "adoptionSource",
  ]),
  /** Stripe transfer failure — error details are operational, not PII. */
  "payout.transfer_failed": new Set([
    "stripeErrorCode",
    "stripeErrorMessage",
    "amountCents",
    "currency",
  ]),
  /** Staff resolved a blocked payout; the free-text reason stays redacted for non-PII readers. */
  "payout.transfer_block_resolved": new Set([
    "resolution",
    "previousStatus",
    "status",
    "stripeTransferId",
    "legalEntityId",
  ]),
  /** Stripe Connect account cannot currently receive payouts. */
  "payout.transfer_blocked": new Set(["payoutId", "legalEntityId", "reason"]),
  /** Negative net payout that requires manual clawback/reconciliation. */
  "payout.clawback_required": new Set([
    "payoutId",
    "legalEntityId",
    "netAmount",
    "currency",
    "reason",
  ]),
  /** A dispute no invoice carries yet; Stripe's dispute reason code is operational, not PII. */
  "dispute_case.needs_allocation": new Set(["stripeDisputeId", "stripeChargeId", "reason"]),
  /** The finance user's reason is staff-written and about the case, not a person. */
  "dispute_case.allocated": new Set(["stripeDisputeId", "note"]),
  /** Payment dispute opened via Stripe webhook. */
  "payment.dispute_opened": new Set([
    "stripeDisputeId",
    "stripeChargeId",
    "amountCents",
    "currency",
    "reason",
  ]),
  /** Stripe withdrew funds from the platform balance for an open dispute. */
  "payment.dispute_funds_withdrawn": new Set([
    "stripeDisputeId",
    "stripeChargeId",
    "amountCents",
    "currency",
  ]),
  /** Payment dispute closed via Stripe webhook (won/lost outcome). */
  "payment.dispute_closed": new Set([
    "stripeDisputeId",
    "stripeChargeId",
    "outcome",
    "amountCents",
    "currency",
  ]),
  /** Seller requested to withdraw an active lot (admin queue). */
  "lot.withdrawal_requested": new Set(["sellerLegalEntityId"]),
  /** A staff decision on a request to bid in a sale. `reason` is the staff-written explanation of a decline. */
  "sale_registration.decided": new Set([
    "saleId",
    "userId",
    "buyerLegalEntityId",
    "decision",
    "bidLimit",
    "reason",
  ]),
  /** A staff change to the bidding limit on one sale registration; null means no limit. */
  "sale_registration.bid_limit_changed": new Set([
    "saleId",
    "userId",
    "buyerLegalEntityId",
    "previousLimit",
    "limit",
  ]),
  /** Staff declined a seller's withdrawal request; the reason is shown to the seller. */
  "lot.withdrawal_declined": new Set(["sellerLegalEntityId", "reason"]),
  /** Pending payment cancelled by buyer or expired by cron. */
  "payment.cancelled": new Set(["lotId", "buyerUserId", "reason"]),
  /** Hosted Checkout attempt failed; payment row stays open for retry. */
  "payment.checkout_failed": new Set([
    "paymentId",
    "lotId",
    "buyerUserId",
    "stripePaymentIntentId",
    "statusBefore",
  ]),
  /** Payment refunded via Stripe webhook or admin action. */
  "payment.refunded": new Set([
    "stripeChargeId",
    "amountCents",
    "amount",
    "currency",
    "via",
    "reason",
    "staffReason",
  ]),
  /** A counted refund Stripe reported failed or cancelled: taken back from the totals. */
  "payment.refund_reversed": new Set([
    "stripeChargeId",
    "amountCents",
    "sellerAmountCents",
    "cumulativeRefundedCents",
    "currency",
    "via",
  ]),
  /** Buyer payment paused because seller was archived before capture. */
  "payment.requires_manual_review": new Set([
    "paymentId",
    "lotId",
    "buyerUserId",
    "buyerLegalEntityId",
    "sellerLegalEntityId",
    "amount",
    "currency",
    "reason",
  ]),
  "payment.manual_review_released": new Set([
    "paymentId",
    "lotId",
    "sellerLegalEntityId",
    "action",
  ]),
  /** UK bank transfer received but underpaid — buyer must send remainder. */
  "payment.bank_transfer_partially_funded": new Set([
    "paymentId",
    "lotId",
    "buyerUserId",
    "amountCents",
    "amountRemainingCents",
    "currency",
  ]),
  /** Money we could not apply to an invoice: operational codes and provider references only. */
  "payment.unapplied_money_received": new Set([
    "reason",
    "dedupeKey",
    "stripeChargeId",
    "stripeCustomerId",
    "stripeEventId",
    "privateSaleDealId",
    "privateSaleDealReference",
    "privateSaleDealPaymentId",
    "shopOrderId",
    "shopOrderReference",
    "shopCheckoutSessionId",
    "transferReference",
    "possibleGroup.id",
    "possibleGroup.status",
  ]),
  /** How it was closed; a staff note is kept, as a refund's staff reason is. */
  "payment.unapplied_money_resolved": new Set(["dedupeKey", "stripeChargeId", "via", "note"]),
  /** Several invoices of one account put into one checkout ("Pay several"); amounts and rail. */
  "payment_group.created": new Set(["total", "checkoutRail"]),
  "payment_group.paid": new Set(["total"]),
  /** Why the group's checkout ended (cancelled, expired, failed); operational codes only. */
  "payment_group.released": new Set(["reason"]),
  /** The repair took failed refunds back from a courier quote's or the unattributed figure. */
  "payment_group.refund_reversed": new Set(["via"]),
  /** Why money received for a group was not applied (an operational code). */
  "payment_group.settlement_refused": new Set(["reason"]),
  /** Which dispute stage needs the finance team to allocate it across the invoices. */
  "payment_group.dispute_needs_allocation": new Set(["stage", "reason"]),
  /** Stripe transfer reversal — negative payout_line inserted for balance correction. */
  "payout.transfer_reversed": new Set([
    "stripeTransferId",
    "reversedAmountCents",
    "currency",
    "stripeEventId",
  ]),
  /** AML watchlist screening evaluated — operational reference fields only (no PII). */
  "aml.screening_evaluated": new Set([
    "outcome",
    "matchStatus",
    "monitorStatus",
    "categories",
    "reasons",
  ]),
  /** AML possible/confirmed match flagged for MLRO review (no PII; names live in the secured record). */
  "aml.match_flagged": new Set([
    "outcome",
    "matchStatus",
    "monitorStatus",
    "categories",
    "reasons",
  ]),
  /** Source-of-Funds case opened (CDD Section 6) — operational fields only (no PII). */
  "source_of_funds.required": new Set([
    "sourceOfFundsId",
    "userId",
    "trigger",
    "thresholdAmount",
    "exposureAmount",
    "currency",
  ]),
  /** Source-of-Funds MLRO/finance disposition — operational fields only (no PII). */
  "source_of_funds.reviewed": new Set(["sourceOfFundsId", "userId", "status", "trigger"]),
  /** Staff per-document verification checklist (note may reference buyer data). */
  "source_of_funds.document_reviewed": new Set([
    "sourceOfFundsId",
    "documentId",
    "checks",
    "note",
    "reviewedByUserId",
    "reviewedAt",
  ]),
  /** restricted seller writes — audit only. */
  "item_submission.restricted_entity_write": new Set(["action", "reason"]),
  /** a member left an organisation. */
  "legal_entity.member_left": new Set(["member_user_id", "role_at_leaving", "stopped_bids"]),
  /** invoice details changed: which fields, never their values. */
  "legal_entity.invoice_details_changed": new Set(["changed_fields"]),
  /** a two-step reminder was emailed: how many members, never who. */
  "legal_entity.two_step_reminder_sent": new Set(["recipient_count"]),
  /** contact details changed: which fields, never their values. */
  "legal_entity.contact_details_changed": new Set(["changed_fields"]),
  /** the payout bank account changed: the last four digits and the bank, as Stripe shows them. */
  "legal_entity.payout_bank_changed": new Set(["bank_last4", "bank_name"]),
  /** lot voided at close (anti-shilling). */
  "lot.voided": new Set(["reason"]),
  "sale.created": new Set(["from_status", "to_status", "deliveryMode", "lotCount", "isTest"]),
  "sale.published": new Set(["from_status", "to_status", "lotCount", "deliveryMode"]),
  "sale.unpublished": new Set(["from_status", "to_status"]),
  "sale.rescheduled": new Set(["saleId", "previousStartAt", "newStartAt"]),
  "sale.test_flag_changed": new Set(["isTest", "status"]),
  "sale.cancelled": new Set(["from_status", "to_status", "lotCount", "cancelledLotIds"]),
  "sale.soft_deleted": new Set(["title", "from_status", "lotCount", "deleted_at"]),
  "lot.soft_deleted": new Set(["title", "from_status", "saleId", "deleted_at"]),
  "sale.ended": new Set(["from_status", "to_status", "reason"]),
  "venue.created": new Set(["legalEntityId", "name", "slug", "status"]),
  "venue.updated": new Set(["legalEntityId", "name", "slug", "status", "changedFields"]),
  "venue.archived": new Set(["legalEntityId", "name", "slug", "status"]),
  /** member removed from entity. */
  "legal_entity.member_removed": new Set([
    "member_user_id",
    "removed_by_user_id",
    "role_at_removal",
    "reason",
    "stopped_bids",
  ]),
  /** an unanswered organisation invitation withdrawn, or reopened by its Undo. */
  "legal_entity.invitation_withdrawn": new Set(["invitation_id", "role"]),
  "legal_entity.invitation_restored": new Set(["invitation_id", "role"]),
  /** A buyer reported a problem with a paid purchase; what they wrote stays on the report. */
  "purchase_problem.reported": new Set(["lotId", "paymentId", "category"]),
  /** Staff and status are identifiers and codes; the buyer's message and staff notes stay on the report. */
  "purchase_problem.assigned": new Set([
    "problemId",
    "assignedToUserId",
    "previousAssignedToUserId",
  ]),
  "purchase_problem.status_changed": new Set(["problemId", "from", "to"]),
  "purchase_problem.note_added": new Set(["problemId"]),
  /** A member asked for a role or capability; the reason stays on the request, not the event. */
  "legal_entity.access_requested": new Set([
    "request_id",
    "requester_user_id",
    "requested_role",
    "requested_capability",
  ]),
  /** An owner or admin approved (with the role given) or declined a request for access. */
  "legal_entity.access_request_decided": new Set([
    "request_id",
    "requester_user_id",
    "decision",
    "granted_role",
  ]),
  /** an automatic bid (auto-bid ceiling or absentee bid) stopped because its member was removed. */
  "legal_entity.member_bid_stopped": new Set([
    "bid_kind",
    "bid_ref",
    "lot_id",
    "lot_title",
    "lot_number",
    "max_amount",
    "member_user_id",
    "reason",
  ]),
  /** a member's buyer-agent authorisations ended because they left or their role changed. */
  "legal_entity.member_authorisations_revoked": new Set([
    "member_user_id",
    "authorisations",
    "cause",
  ]),
  /** buyer agent authorised to bid for the organisation (by a member or by staff). */
  "legal_entity.buyer_agent_authorised": new Set([
    "authorisation_id",
    "member_user_id",
    "sale_id",
    "bid_limit",
    "total_limit",
    "valid_from",
    "valid_until",
    "superseded_authorisation_id",
    "granted_by",
  ]),
  /** the organisation's own bidding limit set, changed or removed. */
  "legal_entity.bidding_limit_changed": new Set(["previous_limit", "limit", "changed_by"]),
  "legal_entity.buyer_agent_authorisation_revoked": new Set([
    "authorisation_id",
    "member_user_id",
    "sale_id",
    "reason",
    "revoked_by",
  ]),
  /** archive cascade summary. */
  "legal_entity.archive_cascaded": new Set([
    "legalEntityId",
    "proxiesCancelled",
    "proxyCancelEvents",
    "draftScheduledLotsFlagged",
    "memberNoticeEmails",
  ]),
  /** proxy ceiling cleared — reason is operational (e.g. entity_archived, member_removed). */
  "bid.proxy_cancelled": new Set(["reason"]),
  /** Automatic or self-service status progression (Stripe, KYC, org submit, etc.). */
  "legal_entity.lifecycle_progressed": new Set([
    "from_status",
    "to_status",
    "reason",
    "trigger",
    "kind",
    "stripeAccountId",
  ]),
  /** Subject and export ids only; the request carries nothing personal. */
  "subject.data_export_requested": new Set(),
  /** Which provider was removed; nothing personal. */
  "user.sign_in_method_unlinked": new Set(["provider"]),
  /** Which method was added or removed (google, apple or passkey); never its name or address. */
  "user.sign_in_method_added": new Set(["method"]),
  "user.sign_in_method_removed": new Set(["method"]),
  /** Which provider proved the email; nothing personal. */
  "user.unconfirmed_password_removed": new Set(["provider"]),
  /** Which provider was refused and whether it was a link or a sign-in; nothing personal. */
  "user.social_link_refused_staff": new Set(["provider", "attempt"]),
  "auth.forgot_password_requested": new Set(),
  "auth.password_credential_enabled": new Set(),
  "auth.email_change_started": new Set(),
  "auth.email_change_cancelled": new Set(),
  "auth.email_change_completed": new Set(),
  "auth.reauth_success": new Set(),
  "auth.session_revoked": new Set(["sessionId"]),
  "auth.sessions_revoked_all_except_current": new Set(),
  "auth.two_factor_policy_changed": new Set(["scope", "required", "legalEntityId"]),
  /** The reason is a staff-typed operational note; the person is the aggregate, not a field. */
  "auth.two_factor_reset_by_staff": new Set(["reason"]),
  /**
   * Why staff moved an account to a new address and what they relied on: a staff-typed note, the
   * kind of proof, and the KYC session or ID-check reference. The addresses are not recorded.
   */
  "auth.email_change_requested_by_staff": new Set([
    "reason",
    "proofKind",
    "kycSessionId",
    "proofReference",
  ]),
  /** Why staff asked to withdraw a pending change: a staff-typed note. No address is recorded. */
  "auth.email_change_cancel_requested_by_staff": new Set(["reason"]),
  /** Staff were shown the verified name and date of birth; only the record's id is kept. */
  "auth.email_change_kyc_record_viewed": new Set(["kycSessionId"]),
  "auth.two_factor_security_email": new Set(["kind"]),
  "auth.account_suspended": new Set(),
  /** The reason is a staff-typed operational note; the person is the aggregate, not a field. */
  "bid.user_suspended": new Set(["reason", "bulk"]),
  "bid.user_unsuspended": new Set(["bulk"]),
  "lax.staff_access.granted": new Set([
    "subjectId",
    "product",
    "role",
    "grantedBySubjectId",
    "invitationId",
    "endsAt",
    /** A staff-typed operational note about the role. */
    "reason",
  ]),
  "lax.staff_access.revoked": new Set([
    "subjectId",
    "product",
    "revokedBySubjectId",
    "role",
    "assignmentId",
    /** A staff-typed operational note about the role. */
    "reason",
  ]),
  /** The reason is a staff-typed operational note; the person is the aggregate, not a field. */
  /** Queue and job names are code identifiers; the discard note is a staff-typed operational note. */
  /** The reference of the request (DR-0001 or DL-7F3C1A) and nothing about the person or the notes. */
  /** Stock codes and offer states are catalogue identifiers, not personal data. */
  "artwork_register.catalogue_changed": new Set(["stockCode", "fields"]),
  "artwork_register.offer_changed": new Set(["stockCode", "fromState", "toState"]),
  "artwork_register.stock_code_assigned": new Set(["stockCode"]),
  "data_request.viewed": new Set(["reference"]),
  "data_request.logged": new Set(["reference"]),
  "data_request.updated": new Set(["reference"]),
  "data_request.extended": new Set(["reference"]),
  "data_request.closed": new Set(["reference"]),
  "data_request.continued": new Set(["reference"]),
  "data_request.enquiry_erasure_requested": new Set(["reference"]),
  "data_request.enquiries_erased": new Set(["reference"]),
  "failed_job.retried": new Set(["queue", "jobName", "confirmRepeat"]),
  "failed_job.discarded": new Set(["queue", "jobName", "reason", "note"]),
  "failed_job.restored": new Set(["queue", "jobName"]),
  /** A contact form message arrived or was handled: the topic only; what the sender wrote stays on the enquiry. */
  "marketing_enquiry.received": new Set(["enquiryId", "intent", "department"]),
  "marketing_enquiry.handled": new Set(["enquiryId", "intent"]),
  /** Staff and status are identifiers and codes; the sender's details and staff notes never leave the enquiry. */
  "marketing_enquiry.assigned": new Set([
    "enquiryId",
    "intent",
    "assignedToUserId",
    "previousAssignedToUserId",
    "source",
  ]),
  "marketing_enquiry.status_changed": new Set(["enquiryId", "intent", "from", "to", "closeReason"]),
  "marketing_enquiry.converted": new Set(["enquiryId", "intent", "from"]),
  /** Row counts and the reason staff typed; the address that was erased is never recorded. */
  "marketing_enquiry.erased": new Set([
    "enquiries",
    "notes",
    "attachments",
    "held",
    "alertSubscribers",
    "visitorSaleAlerts",
    "suppressionsKept",
    "reason",
  ]),
  /** Codes and dates; the note is typed by staff, and the address itself is never recorded. */
  "email.block_lifted": new Set([
    "userId",
    "reason",
    "note",
    "previousReason",
    "previousSince",
    "provider",
  ]),
  /** One event per changed routing row: a department slug (or none for the fallback) and staff user ids. */
  /** Identifiers and stage codes only: the parties, the price and the cancel reason stay on the deal. */
  "private_sale_deal.created": new Set(["dealId", "reference", "stage"]),
  "private_sale_deal.stage_changed": new Set(["dealId", "reference", "from", "to"]),
  /** The names of the terms that changed, never their values or who the parties are. */
  "private_sale_deal.terms_changed": new Set(["dealId", "reference", "fields"]),
  "private_sale_deal.party_named": new Set(["dealId", "reference", "role"]),
  "private_sale_deal.terms_accepted": new Set(["dealId", "reference", "role", "version"]),
  "private_sale_deal.payment_started": new Set([
    "dealId",
    "reference",
    "paymentId",
    "rail",
    "amountMinor",
  ]),
  "private_sale_deal.payment_paid": new Set(["dealId", "reference", "paymentId", "amountMinor"]),
  "private_sale_deal.payment_cancelled": new Set(["dealId", "reference", "paymentId", "reason"]),
  /** The bank's reference and who recorded the transfer stay on the payment, not in the event. */
  "private_sale_deal.bank_transfer_recorded": new Set([
    "dealId",
    "reference",
    "paymentId",
    "amountMinor",
  ]),
  /** Finance returned money by bank for a transfer they had recorded; the bank's reference is kept. */
  "private_sale_deal.bank_refund_recorded": new Set([
    "dealId",
    "reference",
    "paymentId",
    "amountMinor",
    "refundedMinor",
    "bankReference",
  ]),
  "private_sale_deal.payment_partly_refunded": new Set([
    "dealId",
    "reference",
    "paymentId",
    "amountMinor",
    "refundedMinor",
  ]),
  "private_sale_deal.payment_refunded": new Set([
    "dealId",
    "reference",
    "paymentId",
    "amountMinor",
  ]),
  /**
   * Identifiers, times and codes only. The collector's name, email and company are never in an
   * event: they stay on the booking, where they can be erased.
   */
  "collection.booking.created": new Set([
    "bookingId",
    "reference",
    "legalEntityId",
    "venueId",
    "slotStart",
    "slotEnd",
    "lotIds",
    "collectorKind",
    "authorised",
    "bookedVia",
    "overCapacity",
    "noticeDeadline",
  ]),
  "collection.booking.changed": new Set([
    "bookingId",
    "reference",
    "legalEntityId",
    "venueId",
    "previousSlotStart",
    "slotStart",
    "slotEnd",
    "lotIds",
    "collectorKind",
    "authorised",
    "bookedVia",
    "overCapacity",
    "icsSequence",
    "noticeDeadline",
  ]),
  "collection.booking.cancelled": new Set([
    "bookingId",
    "reference",
    "legalEntityId",
    "venueId",
    "slotStart",
    "cancelledVia",
    "reason",
  ]),
  "collection.booking.handed_over": new Set([
    "bookingId",
    "reference",
    "legalEntityId",
    "handedOverLotIds",
    "leftLotIds",
    "idCheckType",
    "status",
  ]),
  /** Names of the settings that changed, never their values or the staff note on a closure. */
  "collection.place.updated": new Set([
    "venueId",
    "changed",
    "affectedBookings",
    "cancelledBookings",
    "affectedHandling",
  ]),
  "collection.exception.added": new Set([
    "venueId",
    "exceptionId",
    "kind",
    "source",
    "startsOn",
    "endsOn",
    "partDay",
    "affectedBookings",
    "cancelledBookings",
    "affectedHandling",
  ]),
  "collection.exception.removed": new Set([
    "venueId",
    "exceptionId",
    "kind",
    "source",
    "startsOn",
    "endsOn",
    "partDay",
    "affectedBookings",
    "cancelledBookings",
    "affectedHandling",
  ]),
  "collection.booking.hand_over_undone": new Set(["bookingId", "reference", "legalEntityId"]),
  "collection.booking.not_collected": new Set([
    "bookingId",
    "reference",
    "legalEntityId",
    "slotStart",
  ]),
  "private_sale_deal.payout_queued": new Set([
    "dealId",
    "reference",
    "payoutId",
    "netToSellerMinor",
  ]),
  /** A fixed sentence about the deal's artwork record; no names. */
  "private_sale_deal.artwork_record_not_updated": new Set([
    "dealId",
    "reference",
    "stage",
    "reason",
    "message",
  ]),
  "private_sale_deal.settlement_follow_up_raised": new Set(["dealId", "reference", "severity"]),
  "private_sale_deal.artwork_mark_sold_retried": new Set(["dealId", "reference", "outcome"]),
  "enquiry_routing.changed": new Set([
    "departmentSlug",
    "assignedToUserId",
    "previousAssignedToUserId",
  ]),
  "staff.role_assigned": new Set(["assignmentId", "role", "startsAt", "endsAt", "reason"]),
  "staff.role_removed": new Set(["assignmentId", "role", "reason"]),
  "staff.role_expired": new Set(["assignmentId", "role", "endedAt"]),
};

export function isExceptionPath(eventType: string, path: string): boolean {
  const set = EXCEPTION_PATHS[eventType];
  if (!set) return false;
  if (set.has(path)) return true;
  // The elements of a listed array ("lotIds.0", "lotIds.1") are covered by the array's own path.
  const withoutIndexes = path
    .split(".")
    .filter((segment) => !/^\d+$/.test(segment))
    .join(".");
  return withoutIndexes !== path && set.has(withoutIndexes);
}

export function isSafeLeaf(eventType: string, path: string, segment: string): boolean {
  if (isExceptionPath(eventType, path)) return true;
  if (isLikelyReferenceKey(segment)) return true;
  return false;
}

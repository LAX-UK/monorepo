/**
 * The one map from a raw event code to the sentence staff read. Every event type the platform
 * emits has an entry (a test enforces it); `domainEventLabel` falls back to a readable sentence
 * for anything new so the audit log never shows a raw code.
 */
const LABELS: Record<string, string> = {
  "admin.impersonation_started": "Impersonation started",
  "admin.impersonation_ended": "Impersonation ended",

  "aml.match_flagged": "AML match flagged",
  "aml.screening_evaluated": "AML screening evaluated",
  "aml.screening_completed": "AML screening completed",
  "aml.screening_cleared": "AML screening cleared",
  "aml.screening_blocked": "AML screening blocked",

  "artist.approved": "Artist approved",
  "artist.deleted": "Artist deleted",
  "artist.merged": "Artists merged",
  "artist.propose_matches": "Artist matches proposed",
  "artist.reviewed": "Artist reviewed",

  "auth.account_suspended": "Account suspended",
  "auth.user_suspended": "User suspended",
  "auth.user_reactivated": "User reactivated",
  "auth.email_change_started": "Email change started",
  "auth.email_change_completed": "Email change completed",
  "auth.email_change_cancelled": "Email change cancelled",
  "auth.forgot_password_requested": "Password reset requested",
  "auth.password_credential_enabled": "Password sign-in enabled",
  "auth.reauth_success": "Identity re-confirmed",
  "auth.session_revoked": "Session signed out",
  "auth.sessions_revoked_all_except_current": "Other sessions signed out",
  "auth.two_factor_policy_changed": "Two-step verification policy changed",
  "auth.two_factor_reset_by_staff": "Two-step verification reset by staff",
  "auth.two_factor_security_email": "Two-step security email sent",

  "bid.first_for_user": "First bid placed",
  "bid.lot_won": "Lot won",
  "bid.outbid": "Bidder outbid",
  "bid.placed": "Bid placed",
  "bid.proxy_cancelled": "Proxy bid cancelled",
  "bid.user_suspended": "Bidder suspended",
  "bid.user_unsuspended": "Bidder reactivated",

  "category.created": "Category created",
  "category.updated": "Category updated",
  "category.archived": "Category archived",
  "category.deleted": "Category deleted",

  "condition_report.requested": "Condition report requested",
  "condition_report.in_progress": "Condition report started",
  "condition_report.fulfilled": "Condition report fulfilled",
  "condition_report.declined": "Condition report declined",

  "export.requested": "Export requested",

  "item_submission.submitted": "Submission received",
  "item_submission.approved": "Submission approved",
  "item_submission.rejected": "Submission rejected",
  "item_submission.restricted_entity_write": "Restricted seller record changed",

  "kyc.session_started": "Identity check started",
  "kyc.session_completed": "Identity check completed",
  "kyc.verified": "Identity verified",

  "lax.staff_access.granted": "LAX staff access granted",
  "lax.staff_access.revoked": "LAX staff access revoked",
  "staff.role_assigned": "Staff role given",
  "staff.role_removed": "Staff role removed",
  "staff.role_expired": "Staff role ended",

  "legal_entity.created": "Legal entity created",
  "legal_entity.updated": "Legal entity updated",
  "legal_entity.docs_requested": "Documents requested",
  "legal_entity.docs_received": "Documents received",
  "legal_entity.review_started": "Review started",
  "legal_entity.approved": "Legal entity approved",
  "legal_entity.restricted": "Legal entity restricted",
  "legal_entity.restriction_lifted": "Legal entity restriction lifted",
  "legal_entity.rejected": "Legal entity rejected",
  "legal_entity.archived": "Legal entity archived",
  "legal_entity.archive_cascaded": "Archive cascade completed",
  "legal_entity.lifecycle_progressed": "Lifecycle progressed",
  "legal_entity.stripe_connect_linked": "Stripe Connect linked",
  "legal_entity.stripe_connect_requirements_updated": "Stripe requirements updated",
  "legal_entity.member_invited": "Member invited",
  "legal_entity.member_accepted": "Member accepted invitation",
  "legal_entity.member_declined": "Member declined invitation",
  "legal_entity.invitation_withdrawn": "Invitation withdrawn",
  "legal_entity.invitation_restored": "Withdrawn invitation reopened",
  "legal_entity.member_role_changed": "Member role changed",
  "legal_entity.member_removed": "Member removed",
  "legal_entity.member_left": "Member left",
  "legal_entity.invoice_details_changed": "Invoice details changed",
  "legal_entity.contact_details_changed": "Contact details changed",
  "legal_entity.payout_bank_changed": "Payout bank account changed",
  "legal_entity.member_authorisations_revoked":
    "Buyer agent authorisations ended (member left or changed role)",
  "legal_entity.member_bid_stopped": "Automatic bid stopped (member removed)",
  "legal_entity.access_requested": "Access requested",
  "legal_entity.access_request_decided": "Access request decided",
  "legal_entity.buyer_agent_authorised": "Buyer agent authorised",
  "legal_entity.buyer_agent_authorisation_revoked": "Buyer agent authorisation revoked",
  "legal_entity.bidding_limit_changed": "Organisation bidding limit changed",

  "lot.created": "Lot created",
  "lot.activated": "Lot went live",
  "lot.attached_to_sale": "Attached to sale",
  "lot.detached_from_sale": "Detached from sale",
  "lot.published": "Lot scheduled",
  "lot.unpublished": "Lot reverted to draft",
  "lot.cancelled": "Lot cancelled",
  "lot.ended": "Lot ended",
  "lot.voided": "Lot voided",
  "lot.soft_deleted": "Lot deleted",
  "lot.withdrawal_requested": "Withdrawal requested",
  "lot.withdrawal_declined": "Withdrawal declined",
  "lot.returned_to_inventory": "Returned to inventory",

  "payment.created": "Payment created",
  "payment.authorized": "Payment authorised",
  "payment.captured": "Payment captured",
  "payment.refunded": "Payment refunded",
  "payment.cancelled": "Payment cancelled",
  "payment.bank_transfer_partially_funded": "Bank transfer partly received",
  "payment.capture_blocked_terminal_status": "Capture blocked on a closed payment",
  "payment.checkout_failed": "Checkout failed",
  "payment.manual_review_required": "Manual review required",
  "payment.requires_manual_review": "Manual review required",
  "payment.manual_review_released": "Held payment released",
  "payment.dispute_opened": "Dispute opened",
  "payment.dispute_funds_withdrawn": "Dispute funds withdrawn",
  "payment.dispute_closed": "Dispute closed",

  "payment_group.created": "Several invoices put into one payment",
  "payment_group.processing": "Bank transfer started for several invoices",
  "payment_group.paid": "Several invoices paid together",
  "payment_group.released": "Several invoices handed back to pay separately",
  "payment_group.settlement_refused": "Payment for several invoices needs reconciling",
  "payment_group.refund_unattributed": "Refund on a combined payment needs an invoice",
  "payment_group.dispute_needs_allocation": "Dispute on a combined payment needs allocating",

  "payout.scheduled": "Payout scheduled",
  "payout.paid": "Payout paid",
  "payout.failed": "Payout failed",
  "payout.reversed": "Payout reversed",
  "payout.clawback_required": "Clawback required",
  "payout.settlement_created": "Settlement created",
  "payout.transfer_initiated": "Payout transfer started",
  "payout.transfer_blocked": "Payout transfer blocked",
  "payout.transfer_failed": "Payout transfer failed",
  "payout.transfer_reversed": "Payout transfer reversed",

  "sale.created": "Sale created",
  "sale.published": "Sale published",
  "sale.unpublished": "Sale reverted to draft",
  "sale.cancelled": "Sale cancelled",
  "sale.ended": "Sale marked ended",
  "sale.soft_deleted": "Sale deleted",

  "saleroom.display.paired": "Saleroom display paired",
  "saleroom.display.revoked": "Saleroom display removed",
  "saleroom.display.overlay_set": "Saleroom overlay shown",
  "saleroom.display.overlay_clear": "Saleroom overlay cleared",

  "shop.artwork.created": "Artwork created",
  "shop.artwork.updated": "Artwork updated",
  "shop.artwork.interest_registered": "Artwork interest registered",
  "shop.edition.reserved": "Edition reserved",
  "shop.edition.released": "Edition released",
  "shop.edition.sold": "Edition sold",
  "shop.editions.allocated": "Editions allocated",
  "shop.order.paid": "Order paid",
  "shop.guest_lead.recorded": "Guest lead recorded",
  "shop.guest_lead.claimed": "Guest orders and enquiries moved to an account",
  "shop.guest_lead.erased": "Guest personal data erased",
  "shop.sale_authority.changed": "Sale authority changed",
  "shop.production.started": "Production started",
  "shop.fulfilment.dispatched": "Order dispatched",
  "shop.possession.recorded": "Possession recorded",
  "shop.refund.requested": "Refund requested",
  "shop.refund.completed": "Refund completed",
  "shop.cancellation.requested": "Cancellation requested",
  "shop.dispute.opened": "Dispute opened",
  "shop.dispute.closed": "Dispute closed",
  "shop.payout.paid": "Payout paid",
  "shop.stock_hold.created": "Stock held",
  "shop.stock_hold.released": "Stock hold released",
  "shop.stock_hold.expired": "Stock hold expired",
  "shop.third_party_sale.recorded": "Third-party sale recorded",
  "shop.sale_fee.approved": "Sale fee approved",
  "shop.original_sale.reserved": "Original reserved for sale",

  "source_of_funds.required": "Source of Funds required",
  "source_of_funds.case_opened": "Source of Funds case opened",
  "source_of_funds.documents_requested": "Source of Funds documents requested",
  "source_of_funds.documents_submitted": "Source of Funds documents submitted",
  "source_of_funds.document_uploaded": "Source of Funds document uploaded",
  "source_of_funds.document_downloaded": "Source of Funds document downloaded",
  "source_of_funds.document_reviewed": "Source of Funds document reviewed",
  "source_of_funds.reviewed": "Source of Funds reviewed",
  "source_of_funds.approved": "Source of Funds approved",
  "source_of_funds.rejected": "Source of Funds rejected",

  "user.registered": "Account created",
  "user.email_verified": "Email verified",
  "user.profile_updated": "Profile updated",
  "user.credential_changed": "Sign-in method changed",
  "user.session_revoked": "Session signed out",
  "user.suspended": "Account suspended",
  "user.deletion_requested": "Account deletion requested",
  "user.deletion_cancelled": "Account deletion cancelled",
  "user.identity_enabled": "Identity enabled",
  "user.identity_disabled": "Identity disabled",
  "user.identity_deleted": "Identity deleted",
  "user.identity_merged": "Identity merged",

  "venue.created": "Venue created",
  "venue.updated": "Venue updated",
  "venue.archived": "Venue archived",
};

function sentenceCase(text: string): string {
  const spaced = text.replace(/[._]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase() : text;
}

/** "Lot withdrawal declined" for `lot.withdrawal_declined`; a readable sentence for unknown codes. */
export function domainEventLabel(eventType: string): string {
  const known = LABELS[eventType];
  if (known) return known;
  const [, ...rest] = eventType.split(".");
  return sentenceCase(rest.length > 0 ? rest.join(" ") : eventType);
}

/** True when the code has a hand-written label rather than the readable fallback. */
export function hasDomainEventLabel(eventType: string): boolean {
  return eventType in LABELS;
}

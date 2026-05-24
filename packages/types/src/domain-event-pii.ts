/** domain event payload minimisation for logs and exports.
 * Default-deny for string leaves; recursive walk with per-event allowlists.
 */

export type RedactDomainEventPayloadOptions = {
  /** When true (e.g. caller holds `audit.read_pii`), payload is returned unchanged. */
  includePii?: boolean;
};

/** Keys that are treated as non-PII references when no explicit exception path matches. */
const SAFE_LEAF_KEY = /^[a-z][a-zA-Z0-9]*$/;
function isLikelyReferenceKey(segment: string): boolean {
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
const EXCEPTION_PATHS: Record<string, Set<string>> = {
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
  "legal_entity.rejected": new Set(["from_status", "to_status", "reason"]),
  "legal_entity.archived": new Set(["from_status", "to_status", "reason"]),
  /** Stripe transfer initiation success — all fields are safe operational data. */
  "payout.transfer_initiated": new Set([
    "stripeTransferId",
    "amountCents",
    "currency",
    "stripeConnectAccountId",
  ]),
  /** Stripe transfer failure — error details are operational, not PII. */
  "payout.transfer_failed": new Set([
    "stripeErrorCode",
    "stripeErrorMessage",
    "amountCents",
    "currency",
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
  /** Pending payment cancelled by buyer or expired by cron. */
  "payment.cancelled": new Set(["lotId", "buyerUserId", "reason"]),
  /** Payment refunded via Stripe webhook or admin action. */
  "payment.refunded": new Set([
    "stripeChargeId",
    "amountCents",
    "amount",
    "currency",
    "via",
    "reason",
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
  /** Stripe transfer reversal — negative payout_line inserted for balance correction. */
  "payout.transfer_reversed": new Set([
    "stripeTransferId",
    "reversedAmountCents",
    "currency",
    "stripeEventId",
  ]),
  /** restricted seller writes — audit only. */
  "item_submission.restricted_entity_write": new Set(["action", "reason"]),
  /** lot voided at close (anti-shilling). */
  "lot.voided": new Set(["reason"]),
  "sale.created": new Set(["from_status", "to_status", "deliveryMode", "lotCount"]),
  "sale.published": new Set(["from_status", "to_status", "lotCount", "deliveryMode"]),
  "sale.unpublished": new Set(["from_status", "to_status"]),
  "sale.cancelled": new Set(["from_status", "to_status", "lotCount"]),
  "sale.soft_deleted": new Set(["title", "from_status", "lotCount", "deleted_at"]),
  "sale.ended": new Set(["from_status", "to_status", "reason"]),
  /** member removed from entity. */
  "legal_entity.member_removed": new Set([
    "member_user_id",
    "removed_by_user_id",
    "role_at_removal",
    "reason",
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
  "auth.forgot_password_requested": new Set(),
  "auth.password_credential_enabled": new Set(),
  "auth.email_change_started": new Set(),
  "auth.email_change_cancelled": new Set(),
  "auth.email_change_completed": new Set(),
  "auth.reauth_success": new Set(),
  "auth.session_revoked": new Set(["sessionId"]),
  "auth.sessions_revoked_all_except_current": new Set(),
  "auth.two_factor_security_email": new Set(["kind"]),
  "auth.account_suspended": new Set(),
};

function isExceptionPath(eventType: string, path: string): boolean {
  const set = EXCEPTION_PATHS[eventType];
  return set ? set.has(path) : false;
}

function isSafeLeaf(eventType: string, path: string, segment: string): boolean {
  if (isExceptionPath(eventType, path)) return true;
  if (isLikelyReferenceKey(segment)) return true;
  return false;
}

function redactLeaf(
  eventType: string,
  path: string,
  segment: string,
  value: string,
  opts: RedactDomainEventPayloadOptions,
): string {
  if (opts.includePii) return value;
  if (isSafeLeaf(eventType, path, segment)) return value;
  return "[REDACTED]";
}

function walk(
  eventType: string,
  value: unknown,
  path: string,
  opts: RedactDomainEventPayloadOptions,
): unknown {
  if (opts.includePii) return value;
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const segment = path.includes(".") ? (path.split(".").pop() ?? path) : path;
    return redactLeaf(eventType, path, segment, value, opts);
  }
  if (Array.isArray(value)) {
    return value.map((item, i) =>
      walk(eventType, item, path === "" ? `${i}` : `${path}.${i}`, opts),
    );
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path === "" ? k : `${path}.${k}`;
      out[k] = walk(eventType, v, nextPath, opts);
    }
    return out;
  }
  return value;
}

/** Minimises PII in a stored domain event payload for exports and worker logs.
 * @param eventType `domain_events.event_type`
 * @param payload JSON payload object
 */
export function redactDomainEventPayload(
  eventType: string,
  payload: unknown,
  opts: RedactDomainEventPayloadOptions = {},
): unknown {
  if (opts.includePii) return payload;
  return walk(eventType, payload, "", opts);
}

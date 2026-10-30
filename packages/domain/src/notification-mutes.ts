/**
 * What an organisation mute silences.
 *
 * A mute ("Don't notify me about this organisation") only quiets informational notices. Notices
 * that carry an obligation, a decision, money or security are always delivered, in-app and by
 * email, because missing them costs the person or the organisation: an unpaid invoice, a won lot,
 * an agreement waiting for acceptance, a role change. Extend this table, not the callers.
 *
 * Covered by the policy as notice types are added: bid refused for a limit and payout problems
 * have no notification type yet; give them one in this table when they do.
 */
export const NOTIFICATION_ALWAYS_DELIVERED_TYPES = [
  // Money owed or received: payment due (the invoice) and won lots.
  "payment_due",
  "lot_won",
  // Consignments waiting for the person to act.
  "consignment_agreement_reminder",
  "submission_changes_requested",
  // Identity, compliance and security.
  "kyc_resubmission_required",
  "source_of_funds_documents_requested",
  "source_of_funds_approved",
  "source_of_funds_rejected",
  // Membership: a member left the organisation.
  "organisation_member_left",
  // Payout bank account changed: a fraud route, so the people who handle the money always hear.
  "payout_bank_changed",
  // Roles and access.
  "staff_role_expired",
  "staff_role_expired_admin",
  "staff_role_changed",
  "staff_role_changed_admin",
] as const;

const ALWAYS_DELIVERED = new Set<string>(NOTIFICATION_ALWAYS_DELIVERED_TYPES);

/** Whether a mute may silence this notice. Required notices always get through. */
export function notificationIsMutable(type: string): boolean {
  return !ALWAYS_DELIVERED.has(type);
}

/**
 * Whether a notice is silenced for its recipient: it is about an account they muted and it is
 * informational. Personal notices (no account) are never muted.
 */
export function notificationSilencedByMute(
  notice: { type: string; legalEntityId: string | null | undefined },
  mutedAccountIds: ReadonlySet<string> | readonly string[],
): boolean {
  if (notice.legalEntityId == null || !notificationIsMutable(notice.type)) return false;
  const muted =
    mutedAccountIds instanceof Set
      ? mutedAccountIds.has(notice.legalEntityId)
      : (mutedAccountIds as readonly string[]).includes(notice.legalEntityId);
  return muted;
}

/**
 * Security alerts that go out during a person's quiet hours too. Quiet hours drop email and push
 * rather than delay them, and a payout bank change someone did not make has to be seen at once.
 */
export const NOTIFICATION_IGNORES_QUIET_HOURS_TYPES = ["payout_bank_changed"] as const;

const IGNORES_QUIET_HOURS = new Set<string>(NOTIFICATION_IGNORES_QUIET_HOURS_TYPES);

export function notificationIgnoresQuietHours(type: string): boolean {
  return IGNORES_QUIET_HOURS.has(type);
}

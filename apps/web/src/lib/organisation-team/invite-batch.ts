/**
 * Inviting several people at once: which addresses are usable, what the send button says, and
 * what to tell the person once every invitation has been answered. Each address is sent on its
 * own, so one refusal never stops the others.
 */

/** Enough to catch a typo before sending; the server has the final word. */
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

export const MAX_INVITES_AT_ONCE = 20;

/** Why an address can't be sent, or `null` when it can. */
export function inviteEmailProblem(email: string): string | null {
  return EMAIL.test(email) ? null : "Not an email address";
}

/** Addresses are kept trimmed and lower-cased, so one person is never listed twice. */
export function normaliseInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Why the batch can't be sent yet, or `null` when it can. */
export function inviteBatchProblem(emails: readonly string[]): string | null {
  if (emails.length === 0) return "Add at least one email address.";
  if (emails.length > MAX_INVITES_AT_ONCE) {
    return `Invite up to ${MAX_INVITES_AT_ONCE} people at a time.`;
  }
  const bad = emails.filter((email) => inviteEmailProblem(email));
  if (bad.length === 1) return `Check ${bad[0]}: it isn't an email address.`;
  if (bad.length > 1) return `${bad.length} entries aren't email addresses. Fix or remove them.`;
  return null;
}

/** "Send invitation" or "Send 3 invitations". */
export function sendInvitesLabel(count: number): string {
  return count > 1 ? `Send ${count} invitations` : "Send invitation";
}

export type InviteOutcome =
  | { email: string; ok: true }
  | { email: string; ok: false; error: string };

export type InviteBatchSummary = {
  /** The toast for what went out; `null` when nothing did. */
  sentTitle: string | null;
  /** The addresses that were refused, each with why, kept in the field to fix or remove. */
  failed: { email: string; error: string }[];
};

export function summariseInviteBatch(
  outcomes: readonly InviteOutcome[],
  organisationName: string,
): InviteBatchSummary {
  const sent = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.flatMap((o) => (o.ok ? [] : [{ email: o.email, error: o.error }]));
  const sentTitle =
    sent === 0
      ? null
      : sent === 1
        ? `Invitation sent to join ${organisationName}`
        : `${sent} invitations sent to join ${organisationName}`;
  return { sentTitle, failed };
}

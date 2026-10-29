import { organisationMembersRefusal } from "@auction/domain";

/** What the person reads when the API refuses an invitation, never a raw code. */
const INVITATION_REFUSALS: Record<string, string> = {
  invitation_expired:
    "This invitation has expired. Ask the person who invited you to send a new one.",
  invitation_not_pending: "This invitation is no longer open. It may have been withdrawn or used.",
  invitation_not_found: "This invitation is no longer open. It may have been withdrawn or used.",
  invitation_email_mismatch: "This invitation is for another email address.",
  already_a_member: "You're already a member of this organisation.",
};

const FALLBACK = "We couldn't accept the invitation. Try again in a moment.";

/**
 * The words for a refused invitation. An organisation whose state closes it to members
 * (`organisation_closed_to_members`, `organisation_restricted_members`) is said in the server's
 * own message, so the page and the API never disagree.
 */
export function invitationRefusalMessage(body: { code?: unknown; error?: unknown } | null): string {
  const code = typeof body?.code === "string" ? body.code : null;
  if (code && organisationMembersRefusal(code)) {
    return typeof body?.error === "string" && body.error.trim()
      ? body.error
      : (organisationMembersRefusal(code)?.message ?? FALLBACK);
  }
  const key = code ?? (typeof body?.error === "string" ? body.error : "");
  return INVITATION_REFUSALS[key] ?? FALLBACK;
}

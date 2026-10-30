import type { TeamTab } from "@/lib/navigation/client-routes";

type CountsInput = {
  /** `null` when a list could not be read: its count is left off rather than shown as 0. */
  members: number | null;
  invitations: readonly { expiresAt: string }[] | null;
  now: Date;
};

/**
 * The Team tab counts. Invitations counts only those still waiting (expired ones sit in the
 * list to resend or remove, but nobody can answer them). Activity has no count.
 */
export function teamTabCounts({
  members,
  invitations,
  now,
}: CountsInput): Partial<Record<TeamTab, number>> {
  const waiting =
    invitations?.filter((invitation) => new Date(invitation.expiresAt).getTime() > now.getTime())
      .length ?? null;
  const counts: Partial<Record<TeamTab, number>> = {};
  if (members !== null) counts.members = members;
  if (waiting !== null) counts.invitations = waiting;
  return counts;
}

import { staffRoleLabel } from "@/lib/presenters/platform-role/platform-role-registry";
import {
  CONSIGNMENT_INBOX_READ_ACCESS,
  CONSIGNMENT_INBOX_REPLY_ACCESS,
  requirementCapabilities,
  staffRolesGranting,
} from "@auction/types";

/**
 * Who may answer clients, in words, from the capability matrix (never a list of role names kept
 * here): the sentence that replaces the composer for staff who can read a thread but not reply.
 */
function rolesFor(requirement: Parameters<typeof requirementCapabilities>[0]): string[] {
  return staffRolesGranting(requirementCapabilities(requirement))
    .filter((role) => role !== "administrator")
    .map((role) => staffRoleLabel(role));
}

function joinOr(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
}

/** "Replies need the Specialist, Client services or Sales manager role. Ask an Administrator in Staff." */
export function replyRolesSentence(): string {
  return `Replies need the ${joinOr(rolesFor(CONSIGNMENT_INBOX_REPLY_ACCESS))} role. Ask an Administrator in Staff.`;
}

/** The roles that open the inbox, for the access page. */
export function inboxReadRoles(): string {
  return joinOr(rolesFor(CONSIGNMENT_INBOX_READ_ACCESS));
}

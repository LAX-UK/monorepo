import { organisationRoleInSentence } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import {
  type ORGANISATION_CLOSED_TO_MEMBERS,
  type ORGANISATION_RESTRICTED_MEMBERS,
  STEPPED_DOWN_OWNER_ROLE,
  authorisationRevocationFor,
  roleBidsThroughAuthorisation,
} from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

/**
 * The words for changes to an organisation's team: confirmations, the consequence of each
 * change and the toasts after it. What actually happens is decided in the domain (the member
 * change policy, what removal stops); this module only says it.
 */

export type ToastCopy = { title: string; description?: string };

/** After a role change, with the one consequence Undo cannot reverse. */
export function roleChangedCopy(
  name: string,
  from: LegalEntityMemberRole,
  to: LegalEntityMemberRole,
  organisationName: string,
): ToastCopy {
  const title = `${name} is now ${organisationRoleInSentence(to)}.`;
  const endsAuthorisations =
    roleBidsThroughAuthorisation(from) &&
    authorisationRevocationFor({
      action: "change_role",
      target: { memberId: "", role: from, isLastOwner: false },
      newRole: to,
    }) !== null;
  return endsAuthorisations
    ? {
        title,
        description: `Their authorisations to bid for ${organisationName} have ended, and Undo won't bring them back.`,
      }
    : { title };
}

export function roleRestoredCopy(name: string, role: LegalEntityMemberRole): ToastCopy {
  return { title: `${name} is ${organisationRoleInSentence(role)} again.` };
}

/** Shown on the row when Undo itself is refused; the role stays as it now is. */
export function undoFailedCopy(name: string, role: LegalEntityMemberRole, reason: string): string {
  return `We couldn't make ${name} ${organisationRoleInSentence(role)} again. ${reason}`;
}

/** The removal dialog: who, from where, and what happens to their bidding. */
export function removeMemberCopy(name: string, organisationName: string) {
  return {
    title: `Remove ${name}?`,
    lines: [
      `${name} will lose access to ${organisationName} straight away.`,
      `Their automatic and absentee bids for ${organisationName} stop, any authorisation to bid for it ends, and their sale registrations can no longer be used to bid for it. Bids they've already placed stand.`,
      "You can invite them again later.",
    ],
    confirmLabel: "Remove member",
    done: (): ToastCopy => ({ title: `${name} has been removed from ${organisationName}.` }),
  };
}

/** The transfer dialog, and the person's own new role once it is done. */
export function transferOwnershipCopy(name: string, organisationName: string) {
  const steppedDown = organisationRoleInSentence(STEPPED_DOWN_OWNER_ROLE);
  return {
    title: `Transfer ownership to ${name}?`,
    lines: [
      `${name} becomes an owner of ${organisationName}, and you become ${steppedDown}.`,
      `As ${steppedDown} you can still run the team, bidding and selling, but only an owner can change owners or the sign-in rules. Only an owner can make you an owner again.`,
    ],
    confirmLabel: "Transfer ownership",
    done: (): ToastCopy => ({
      title: `${name} is now an owner of ${organisationName}.`,
      description: `You're now ${steppedDown}.`,
    }),
  };
}

export const invitationCopy = {
  sent: (email: string): ToastCopy => ({ title: `Invitation sent to ${email}.` }),
  resent: (email: string): ToastCopy => ({
    title: `Invitation sent again to ${email}.`,
    description: "The earlier link no longer works.",
  }),
  withdrawn: (email: string): ToastCopy => ({ title: `Invitation to ${email} withdrawn.` }),
  removed: (email: string): ToastCopy => ({ title: `Expired invitation to ${email} removed.` }),
  reopened: (email: string): ToastCopy => ({ title: `Invitation to ${email} reopened.` }),
};

type InviteRefusalCode =
  | typeof ORGANISATION_RESTRICTED_MEMBERS.code
  | typeof ORGANISATION_CLOSED_TO_MEMBERS.code;

/**
 * Why the invite form is not shown, naming the organisation, for each state that closes it. The
 * organisation's state banner above the tabs already offers "Contact us", so this line does not.
 */
const INVITES_CLOSED: Record<InviteRefusalCode, (organisationName: string) => { line: string }> = {
  organisation_restricted_members: (organisationName) => ({
    line: `${organisationName} can't invite anyone while it's restricted. The people already here keep their access.`,
  }),
  organisation_closed_to_members: (organisationName) => ({
    line: `${organisationName} is closed, so it can't invite anyone.`,
  }),
};

export function invitesClosedCopy(code: string, organisationName: string) {
  const copy =
    INVITES_CLOSED[code as InviteRefusalCode] ?? INVITES_CLOSED.organisation_closed_to_members;
  return copy(organisationName);
}

/** Leaving: what the person loses, what stops, and how they come back. */
export function leaveOrganisationCopy(organisationName: string) {
  return {
    title: `Leave ${organisationName}?`,
    lines: [
      `You'll lose access to ${organisationName} straight away, and Bid will open your own account.`,
      `Your automatic and absentee bids for ${organisationName} stop, and any authorisation to bid for it ends. Bids you've already placed stand.`,
      "To come back, an owner or admin will need to invite you again.",
    ],
    confirmLabel: "Leave",
    done: (): ToastCopy => ({ title: `You've left ${organisationName}.` }),
  };
}

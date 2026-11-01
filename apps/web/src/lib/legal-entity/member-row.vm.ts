import { initials } from "@/components/organisations/initials";
import {
  organisationRoleLabel,
  organisationRoleOptions,
  organisationRoleRank,
} from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { formatDate } from "@/lib/ui/format";
import type { MemberChangeActor } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import {
  type LeaveControl,
  canManageInvitation,
  leaveControl,
  memberRowControls,
} from "./member-controls.vm";
import type { MemberRow, PendingInvitationRow } from "./member-management.actions";

/** One member as the row shows them, with only what the viewer may do to them. */
export type MemberRowView = {
  id: string;
  name: string;
  email: string;
  initials: string;
  /** The person looking at the page. */
  isYou: boolean;
  role: LegalEntityMemberRole;
  roleLabel: string;
  /** "Two-step on"; `null` when the viewer does not see it or it is unknown. */
  twoStep: string | null;
  /** "Active 28 Oct 2026" or "Not signed in yet"; `null` when the viewer does not see it. */
  lastActive: string | null;
  /** The role picker's options, the current role first; `null` shows the role as text. */
  roleOptions: { value: LegalEntityMemberRole; label: string }[] | null;
  /** Handing ownership over, with the phrase to type; owners only. */
  transfer: { confirmPhrase: string } | null;
  canRemove: boolean;
  /** On your own row: whether you may leave, or why not. `null` on everyone else's. */
  leave: LeaveControl | null;
  /** This person's Activity, for viewers who may read it; `null` otherwise. */
  activityHref: string | null;
};

type MemberRowsInput = {
  actor: MemberChangeActor;
  members: readonly MemberRow[];
  /** Two-step sign-in per user, for the people who may see it (owners and admins). */
  twoFactorByUserId?: Readonly<Record<string, boolean | null>> | undefined;
  /** Where one person's Activity opens, when the viewer may read Activity. */
  activityHrefFor?: ((userId: string) => string) | undefined;
  /** The day each person was last active (`YYYY-MM-DD`), for owners and admins. */
  lastActiveByUserId?: Readonly<Record<string, string | null>> | undefined;
};

function twoStepWords(enabled: boolean | null | undefined): string | null {
  if (enabled === true) return "Two-step on";
  if (enabled === false) return "Two-step off";
  return null;
}

/** The day only, never a time; someone the sign-in service has no session for hasn't signed in. */
function lastActiveWords(day: string | null | undefined): string {
  return day ? `Active ${formatDate(`${day}T12:00:00Z`)}` : "Not signed in yet";
}

/** The picker: the current role first, then the others in listing order (owners first). */
function pickerOptions([current, ...others]: readonly LegalEntityMemberRole[]) {
  const rest = [...others].sort((a, b) => organisationRoleRank(a) - organisationRoleRank(b));
  return organisationRoleOptions(current ? [current, ...rest] : rest);
}

/** You first, then by role (owners down to viewers), then by name. */
function listingOrder(a: MemberRowView, b: MemberRowView): number {
  if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
  const byRole = organisationRoleRank(a.role) - organisationRoleRank(b.role);
  return byRole !== 0 ? byRole : a.name.localeCompare(b.name, "en-GB");
}

/** The team as rows, each with the controls the member change policy allows the viewer. */
export function memberRowViews({
  actor,
  members,
  twoFactorByUserId,
  activityHrefFor,
  lastActiveByUserId,
}: MemberRowsInput) {
  const leave = leaveControl(actor, members);
  return members
    .map((member): MemberRowView => {
      const controls = memberRowControls(actor, member, members);
      return {
        id: member.id,
        name: member.user.name,
        email: member.user.email,
        initials: initials(member.user.name),
        isYou: actor.memberId === member.id,
        role: member.role,
        roleLabel: organisationRoleLabel(member.role),
        twoStep: twoFactorByUserId ? twoStepWords(twoFactorByUserId[member.userId]) : null,
        lastActive: lastActiveByUserId ? lastActiveWords(lastActiveByUserId[member.userId]) : null,
        roleOptions: controls.roleOptions.length > 0 ? pickerOptions(controls.roleOptions) : null,
        transfer: controls.transfer,
        canRemove: controls.remove,
        leave: actor.memberId === member.id ? leave : null,
        activityHref: activityHrefFor ? activityHrefFor(member.userId) : null,
      };
    })
    .sort(listingOrder);
}

/** One unanswered invitation as its row shows it. */
export type InvitationRowView = {
  id: string;
  email: string;
  role: LegalEntityMemberRole;
  roleLabel: string;
  /** ["Finance · Sent 29 Oct 2026", "Expires 5 Nov 2026"]: kept whole when the line wraps. */
  detail: [string, string];
  expired: boolean;
  /** Resend and Withdraw are offered (only owners handle owner invitations). */
  canManage: boolean;
};

export function invitationRowViews(
  actor: MemberChangeActor,
  invitations: readonly PendingInvitationRow[],
  now: Date,
): InvitationRowView[] {
  return invitations.map((invitation) => {
    const expired = new Date(invitation.expiresAt).getTime() <= now.getTime();
    const roleLabel = organisationRoleLabel(invitation.role);
    const expiry = `${expired ? "Expired" : "Expires"} ${formatDate(invitation.expiresAt)}`;
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      roleLabel,
      detail: [`${roleLabel} · Sent ${formatDate(invitation.sentAt)}`, expiry],
      expired,
      canManage: canManageInvitation(actor, invitation.role),
    };
  });
}

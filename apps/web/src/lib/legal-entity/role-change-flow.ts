import type { LegalEntityMemberRole } from "@auction/types";
import {
  type ToastCopy,
  roleChangedCopy,
  roleRestoredCopy,
  undoFailedCopy,
} from "./member-change-copy";
import type { MemberChangeResult } from "./member-management.actions";

/** What the flow needs from the page, so it can be tested without React or the network. */
export type RoleChangePorts = {
  /** Sends the change; resolves only once the server has answered. */
  update: (memberId: string, role: LegalEntityMemberRole) => Promise<MemberChangeResult>;
  /** The role the row shows while a change is in flight or after it; `null` shows the saved one. */
  show: (memberId: string, role: LegalEntityMemberRole | null) => void;
  /** Marks the row busy while the server decides. */
  busy: (memberId: string, busy: boolean) => void;
  /** A message on the row that stays until the next change; `null` clears it. */
  rowError: (memberId: string, message: string | null) => void;
  /** A success toast; with `onUndo` it offers Undo for 10 seconds. */
  toast: (copy: ToastCopy, onUndo?: () => void) => void;
};

export type RoleChangeTarget = { id: string; name: string };

/** How long Undo stays on screen. */
export const ROLE_CHANGE_UNDO_MS = 10_000;

/**
 * A role change: the picker shows the new role while the server decides, the success toast
 * appears only once the server has agreed, and Undo sends the previous role back through the
 * same change. A refusal (of the change or of the Undo) puts the saved role back and says why on
 * the row, where it stays; an error never lives only in a toast that disappears.
 */
export async function changeMemberRole(
  ports: RoleChangePorts,
  member: RoleChangeTarget,
  from: LegalEntityMemberRole,
  to: LegalEntityMemberRole,
  organisationName: string,
): Promise<void> {
  if (from === to) return;
  ports.rowError(member.id, null);
  ports.show(member.id, to);
  ports.busy(member.id, true);
  const result = await ports.update(member.id, to);
  ports.busy(member.id, false);
  if (!result.ok) {
    ports.show(member.id, null);
    ports.rowError(member.id, result.error);
    return;
  }
  ports.toast(roleChangedCopy(member.name, from, to, organisationName), () => {
    void undoRoleChange(ports, member, to, from);
  });
}

async function undoRoleChange(
  ports: RoleChangePorts,
  member: RoleChangeTarget,
  current: LegalEntityMemberRole,
  previous: LegalEntityMemberRole,
): Promise<void> {
  ports.rowError(member.id, null);
  ports.show(member.id, previous);
  ports.busy(member.id, true);
  const result = await ports.update(member.id, previous);
  ports.busy(member.id, false);
  if (!result.ok) {
    ports.show(member.id, current);
    ports.rowError(member.id, undoFailedCopy(member.name, previous, result.error));
    return;
  }
  ports.toast(roleRestoredCopy(member.name, previous));
}

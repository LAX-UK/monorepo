/** UX-facing lifecycle chip for admin invitations (distinct from DB `invitation_status`). */
export type InviteLifecyclePill = "sent" | "opened" | "accepted" | "expired" | "bounced";

export type InvitationLifecycleInput = {
  status: string;
  expiresAt: Date;
  openedAt: Date | null;
  inviteEmailLastStatus: string | null;
};

export type InvitationLifecycleDisplay =
  | { kind: "lifecycle"; pill: InviteLifecyclePill }
  | { kind: "revoked" };

export function invitationLifecycleDisplay(
  row: InvitationLifecycleInput,
): InvitationLifecycleDisplay {
  const now = Date.now();
  const expiredByClock = row.expiresAt.getTime() <= now;

  if (row.status === "revoked") {
    return { kind: "revoked" };
  }
  if (row.status === "accepted") {
    return { kind: "lifecycle", pill: "accepted" };
  }
  if (row.status === "expired" || expiredByClock) {
    return { kind: "lifecycle", pill: "expired" };
  }

  if (row.status === "pending") {
    const email = row.inviteEmailLastStatus;
    if (email === "failed" || email === "suppressed") {
      return { kind: "lifecycle", pill: "bounced" };
    }
    if (row.openedAt) {
      return { kind: "lifecycle", pill: "opened" };
    }
    return { kind: "lifecycle", pill: "sent" };
  }

  return { kind: "lifecycle", pill: "expired" };
}

export function invitationCanResendOrRevoke(row: InvitationLifecycleInput): boolean {
  if (row.status !== "pending") return false;
  return row.expiresAt.getTime() > Date.now();
}

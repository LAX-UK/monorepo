import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { UserRole } from "@auction/types";

export type AdminInvitationSummary = {
  id: string;
  email: string;
  targetRole: UserRole;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  openedAt: Date | null;
  inviteEmailLastStatus: string | null;
};

export async function getAdminInvitations(): Promise<AdminInvitationSummary[]> {
  const res = await authedServerFetch("/admin/invitations");
  if (!res.ok) {
    throw new Error(`Failed to load invitations: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: {
      id: string;
      email: string;
      targetRole: string;
      status: string;
      expiresAt: string;
      createdAt: string;
      openedAt?: string | null;
      inviteEmailLastStatus?: string | null;
    }[];
  };
  return body.data.map((r) => ({
    id: r.id,
    email: r.email,
    targetRole: r.targetRole as UserRole,
    status: r.status,
    expiresAt: new Date(r.expiresAt),
    createdAt: new Date(r.createdAt),
    openedAt: r.openedAt ? new Date(r.openedAt) : null,
    inviteEmailLastStatus: r.inviteEmailLastStatus ?? null,
  }));
}

import "server-only";

export type {
  AdminInvitationSummary,
  AdminInvitationsListSummary,
  AdminInvitationsPage,
  AdminInvitationsPageParams,
} from "@/lib/data/http/invitations.shared";

export { getAdminInvitationsPage } from "@/lib/data/http/invitations.reader";

import { getAdminInvitationsPage } from "@/lib/data/http/invitations.reader";

/** Accurate count of pending invitations for the acting admin (nav badge / KPI). */
export async function getAdminInvitationsPendingCount(): Promise<number> {
  const { summary } = await getAdminInvitationsPage({ limit: 1, offset: 0 });
  return summary.pending;
}

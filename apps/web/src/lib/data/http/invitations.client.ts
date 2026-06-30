import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import {
  type AdminInvitationWire,
  type AdminInvitationsPage,
  type AdminInvitationsPageParams,
  buildAdminInvitationsSearchParams,
  parseAdminInvitationsPageBody,
} from "@/lib/data/http/invitations.shared";

/** Browser fetch for admin invitations list (TanStack Query queryFn — not a Server Action). */
export async function fetchAdminInvitationsPage(
  params: AdminInvitationsPageParams,
): Promise<AdminInvitationsPage> {
  const qs = buildAdminInvitationsSearchParams(params);
  const url = `${browserApiBase()}/admin/invitations${qs ? `?${qs}` : ""}`;
  const res = await browserFetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load invitations: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: AdminInvitationWire[];
    total?: number;
    pendingTotal?: number;
    acceptedTotal?: number;
  };
  return parseAdminInvitationsPageBody(body);
}

import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import {
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
  const url = `${browserApiBase()}/admin/invitations?${qs.toString()}`;
  const res = await browserFetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load invitations: ${res.status}`);
  }
  const body = await res.json();
  return parseAdminInvitationsPageBody(body, params);
}

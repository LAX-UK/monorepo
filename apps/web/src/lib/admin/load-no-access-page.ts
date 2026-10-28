import "server-only";

import { isAdminPath } from "@/lib/admin/admin-return-path";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { staffRolesThatCanOpen } from "@/lib/navigation/admin-route-access";
import {
  type CapabilityRequirement,
  type UserRole,
  staffRoleDefaultDestination,
} from "@auction/types";

/** Names a page and the capability it needs; supplied by the navigation, which owns that table. */
export type NavItemLookup = (
  path: string,
) => { label: string; requirement?: CapabilityRequirement } | null;

export interface NoAccessPageData {
  /** The page that was refused, by its navigation name. */
  resource: string;
  /** Display names of the roles that can open it; empty when the page is unknown. */
  roles: string[];
  /** The person's own overview. */
  home: string;
}

/** What the no-access page says; null when nobody is signed in. */
export async function loadNoAccessPage(
  from: string | string[] | undefined,
  findNavItem: NavItemLookup,
): Promise<NoAccessPageData | null> {
  const user = await getServerSessionUser();
  if (!user) return null;
  const path = typeof from === "string" && isAdminPath(from) ? from : null;
  const item = path ? findNavItem(path) : null;
  return {
    resource: item?.label ?? "this page",
    roles: path ? staffRolesThatCanOpen(path, item?.requirement) : [],
    home: staffRoleDefaultDestination(user.role as UserRole, user.staffRoles),
  };
}

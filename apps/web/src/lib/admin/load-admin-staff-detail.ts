import { loadAdminUserDetail } from "@/lib/admin/load-admin-user-detail";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerLaxAdminRoles } from "@/lib/data/http/staff-roles.server";
import {
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { redirect } from "next/navigation";
import { cache } from "react";

export type AdminStaffDetailBundle = {
  user: AdminUserDetailPayload;
  canManageRoles: boolean;
  canModerate: boolean;
};

async function holdsLaxAdminRoles(userId: string): Promise<boolean> {
  const roles = await getServerLaxAdminRoles(userId).catch(() => null);
  return (roles?.assignments.length ?? 0) > 0;
}

export const loadAdminStaffDetail = cache(
  async (userId: string): Promise<AdminStaffDetailBundle> => {
    await requireAdminCapability(USERS_DIRECTORY_ACCESS, `/admin/staff/${userId}`);
    const user = await loadAdminUserDetail(userId);
    // Someone with LAX Admin roles only is staff too: their roles are managed on this record.
    if (user.role !== "staff" && !(await holdsLaxAdminRoles(userId))) {
      redirect(`/admin/clients/${userId}`);
    }
    const sessionUser = await getServerSessionUser();
    const actorRole = (sessionUser?.role ?? "client") as UserRole;
    const actorStaff = sessionUser?.staffRoles;
    const canManageRoles =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, USER_ROLE_MANAGEMENT_ACCESS);
    const canModerate =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, USER_MODERATION_ACCESS);
    return { user, canManageRoles, canModerate };
  },
);

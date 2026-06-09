import { loadAdminUserDetail } from "@/lib/admin/load-admin-user-detail";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
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

export const loadAdminStaffDetail = cache(
  async (userId: string): Promise<AdminStaffDetailBundle> => {
    const user = await loadAdminUserDetail(userId);
    if (user.role !== "staff") {
      redirect(`/admin/clients/${userId}`);
    }
    const sessionUser = await getServerSessionUser();
    const actorRole = (sessionUser?.role ?? "client") as UserRole;
    const actorStaff = sessionUser?.staffRole ?? null;
    const canManageRoles =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, USER_ROLE_MANAGEMENT_ACCESS);
    const canModerate =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, USER_MODERATION_ACCESS);
    return { user, canManageRoles, canModerate };
  },
);

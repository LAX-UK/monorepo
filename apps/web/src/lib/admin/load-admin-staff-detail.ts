import { loadAdminUserDetail } from "@/lib/admin/load-admin-user-detail";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { redirect } from "next/navigation";
import { cache } from "react";

export type AdminStaffDetailBundle = {
  user: AdminUserDetailPayload;
};

export const loadAdminStaffDetail = cache(
  async (userId: string): Promise<AdminStaffDetailBundle> => {
    const user = await loadAdminUserDetail(userId);
    if (user.role !== "staff") {
      redirect(`/admin/clients/${userId}`);
    }
    return { user };
  },
);

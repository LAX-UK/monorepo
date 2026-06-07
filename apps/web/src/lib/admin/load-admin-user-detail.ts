import { type AdminUserDetailPayload, getAdminUserById } from "@/lib/data/http/admin.server";
import { notFound } from "next/navigation";
import { cache } from "react";

/** Cached fetch for any admin user detail route (clients, staff). */
export const loadAdminUserDetail = cache(
  async (userId: string): Promise<AdminUserDetailPayload> => {
    let user: AdminUserDetailPayload | null = null;
    try {
      user = await getAdminUserById(userId);
    } catch {
      user = null;
    }
    if (!user) notFound();
    return user;
  },
);

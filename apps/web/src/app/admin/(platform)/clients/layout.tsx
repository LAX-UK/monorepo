import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { USERS_DIRECTORY_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminClientsLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(USERS_DIRECTORY_ACCESS, "/admin/clients");
  return children;
}

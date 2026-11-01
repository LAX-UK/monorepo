import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONSIGNMENT_INBOX_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

export default async function AdminInboxLayout({ children }: { children: ReactNode }) {
  await requireAdminCapability(CONSIGNMENT_INBOX_READ_ACCESS, "/admin/inbox");
  return children;
}

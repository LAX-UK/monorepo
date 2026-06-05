import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";

export default async function OnsiteEventsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminCapability(SALEROOM_ACCESS, "/admin/onsite-events");
  return children;
}

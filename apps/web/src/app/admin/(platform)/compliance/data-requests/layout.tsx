import { createAdminSegmentLayout } from "@/lib/auth/create-admin-segment-layout";
import { DATA_REQUESTS_MANAGE_ACCESS } from "@/lib/navigation/staff-nav-access";

export default createAdminSegmentLayout(
  "/admin/compliance/data-requests",
  DATA_REQUESTS_MANAGE_ACCESS,
);

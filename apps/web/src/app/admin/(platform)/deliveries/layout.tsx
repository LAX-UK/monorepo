import { createAdminSegmentLayout } from "@/lib/auth/create-admin-segment-layout";
import { DELIVERIES_READ_ACCESS } from "@/lib/navigation/staff-nav-access";

export default createAdminSegmentLayout("/admin/deliveries", DELIVERIES_READ_ACCESS);

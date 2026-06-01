import { createAdminSegmentLayout } from "@/lib/auth/create-admin-segment-layout";
import { ADMIN_HOME_ACCESS } from "@/lib/navigation/staff-nav-access";

export default createAdminSegmentLayout("/admin", ADMIN_HOME_ACCESS);

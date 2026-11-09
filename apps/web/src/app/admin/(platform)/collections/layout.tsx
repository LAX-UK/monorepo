import { createAdminSegmentLayout } from "@/lib/auth/create-admin-segment-layout";
import { COLLECTIONS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";

export default createAdminSegmentLayout("/admin/collections", COLLECTIONS_READ_ACCESS);

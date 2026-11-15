import { createAdminSegmentLayout } from "@/lib/auth/create-admin-segment-layout";
import { COLLECTIONS_PAGE_ACCESS } from "@/lib/navigation/staff-nav-access";

export default createAdminSegmentLayout("/admin/collections", COLLECTIONS_PAGE_ACCESS);

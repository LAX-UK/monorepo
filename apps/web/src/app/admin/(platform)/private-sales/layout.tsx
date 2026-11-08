import { createAdminSegmentLayout } from "@/lib/auth/create-admin-segment-layout";
import { PRIVATE_SALE_DEALS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";

export default createAdminSegmentLayout("/admin/private-sales", PRIVATE_SALE_DEALS_READ_ACCESS);

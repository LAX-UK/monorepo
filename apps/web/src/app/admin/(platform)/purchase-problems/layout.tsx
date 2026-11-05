import { createAdminSegmentLayout } from "@/lib/auth/create-admin-segment-layout";
import { PURCHASE_PROBLEMS_ACCESS } from "@/lib/navigation/staff-nav-access";

export default createAdminSegmentLayout("/admin/purchase-problems", PURCHASE_PROBLEMS_ACCESS);

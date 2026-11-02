import "server-only";

import { getAdminEnquiry } from "@/lib/data/http/admin-enquiry.reader";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { MARKETING_ENQUIRIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

/** One enquiry with what the signed-in person may do on it; null when there is no such enquiry. */
export async function loadAdminEnquiryPage(id: string) {
  const [enquiry, user] = await Promise.all([getAdminEnquiry(id), getServerSessionUser()]);
  if (!enquiry) return null;
  return {
    enquiry,
    canAct: user
      ? userHasAccessTo(user.role as UserRole, user.staffRoles, MARKETING_ENQUIRIES_ACCESS)
      : false,
  };
}

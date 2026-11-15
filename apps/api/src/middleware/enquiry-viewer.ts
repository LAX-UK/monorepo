import {
  ENQUIRY_ASSIGN_ACCESS,
  MARKETING_ENQUIRIES_ACCESS,
  PRIVATE_SALE_ENQUIRIES_READ_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import type { Context } from "hono";
import type { EnquiryStaffViewer } from "../services/interfaces/marketing-enquiry-service.js";

/** What the signed-in person may read and do on enquiries, from their capabilities. */
export function enquiryViewerOf(c: Context): EnquiryStaffViewer {
  const role = c.get("userRole") as UserRole;
  const staff = c.get("userStaffRoles") as StaffRoles | undefined;
  return {
    userId: c.get("userId") as string,
    readsGeneral: userHasAccessTo(role, staff, MARKETING_ENQUIRIES_ACCESS),
    readsPrivateSale: userHasAccessTo(role, staff, PRIVATE_SALE_ENQUIRIES_READ_ACCESS),
    canAssign: userHasAccessTo(role, staff, ENQUIRY_ASSIGN_ACCESS),
  };
}

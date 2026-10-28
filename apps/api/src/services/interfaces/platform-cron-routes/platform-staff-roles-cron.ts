import type { StaffRoleExpiryResult } from "../../staff/staff-role-expiry.service.js";

export interface IPlatformStaffRolesCronApplicationService {
  /** Records staff roles whose end date has passed, once each, and tells the people involved. */
  expireEndedRoles(): Promise<StaffRoleExpiryResult>;
}

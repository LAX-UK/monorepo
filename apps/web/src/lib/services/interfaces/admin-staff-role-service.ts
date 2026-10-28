import type { AdminAssignStaffRoleBody, AdminRemoveStaffRoleBody } from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

/** Giving and removing a staff member's Bid roles through the Bid API. */
export interface IAdminStaffRoleService {
  assign(userId: string, body: AdminAssignStaffRoleBody): Promise<ServiceResult<unknown>>;
  remove(userId: string, body: AdminRemoveStaffRoleBody): Promise<ServiceResult<unknown>>;
}

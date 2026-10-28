import type {
  AdminAssignLaxAdminRoleBody,
  AdminAssignStaffRoleBody,
  AdminRemoveLaxAdminRoleBody,
  AdminRemoveStaffRoleBody,
} from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

/** Giving and removing a person's roles on one admin through the Bid API. */
export interface IAdminStaffRoleService<
  Assign = AdminAssignStaffRoleBody,
  Remove = AdminRemoveStaffRoleBody,
> {
  assign(userId: string, body: Assign): Promise<ServiceResult<unknown>>;
  remove(userId: string, body: Remove): Promise<ServiceResult<unknown>>;
}

/** The same for LAX Admin roles, which Bid admin manages too. */
export type IAdminLaxAdminRoleService = IAdminStaffRoleService<
  AdminAssignLaxAdminRoleBody,
  AdminRemoveLaxAdminRoleBody
>;

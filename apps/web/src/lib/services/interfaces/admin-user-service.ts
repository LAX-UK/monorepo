import type {
  adminPatchStaffRoleBodySchema,
  adminResetTwoFactorBodySchema,
  adminSetRoleBodySchema,
  adminSuspendBodySchema,
} from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type AdminSetRoleBody = z.infer<typeof adminSetRoleBodySchema>;
export type AdminPatchStaffRoleBody = z.infer<typeof adminPatchStaffRoleBodySchema>;
export type AdminSuspendBody = z.infer<typeof adminSuspendBodySchema>;
export type AdminResetTwoFactorBody = z.infer<typeof adminResetTwoFactorBodySchema>;

export interface IAdminUserService {
  setRole(userId: string, body: AdminSetRoleBody): Promise<ServiceResult<Record<string, unknown>>>;
  setStaffRole(
    userId: string,
    body: AdminPatchStaffRoleBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  suspend(userId: string, body: AdminSuspendBody): Promise<ServiceResult<Record<string, unknown>>>;
  unsuspend(userId: string): Promise<ServiceResult<Record<string, unknown>>>;
  resetTwoFactor(
    userId: string,
    body: AdminResetTwoFactorBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
}

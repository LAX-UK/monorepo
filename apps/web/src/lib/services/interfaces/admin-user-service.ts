import type {
  AdminEmailChangeKycRecord,
  AdminStaffEmailChangeBody,
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
  /** Moves the account to a new address for someone who has lost the old inbox. */
  startEmailChange(
    userId: string,
    body: AdminStaffEmailChangeBody,
  ): Promise<ServiceResult<{ pendingEmail: string }>>;
  /** The verified name and date of birth to compare with the caller; null when there is none. */
  emailChangeKycRecord(userId: string): Promise<ServiceResult<AdminEmailChangeKycRecord | null>>;
}

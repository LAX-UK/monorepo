import type {
  AdminEmailChangeKycRecord,
  AdminStaffEmailChangeBody,
  AdminStaffEmailChangeCancelBody,
} from "@auction/validators";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type {
  AdminPatchStaffRoleBody,
  AdminResetTwoFactorBody,
  AdminSetRoleBody,
  AdminSuspendBody,
  IAdminUserService,
} from "../interfaces/admin-user-service";

export class AdminUserService implements IAdminUserService {
  constructor(private readonly api: IAuthedApiClient) {}

  async setRole(
    userId: string,
    body: AdminSetRoleBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/users/${encodeURIComponent(userId)}/role`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async setStaffRole(
    userId: string,
    body: AdminPatchStaffRoleBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/users/${encodeURIComponent(userId)}/staff-role`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async suspend(
    userId: string,
    body: AdminSuspendBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/users/${encodeURIComponent(userId)}/suspend`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async resetTwoFactor(
    userId: string,
    body: AdminResetTwoFactorBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/users/${encodeURIComponent(userId)}/two-factor/reset`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async startEmailChange(
    userId: string,
    body: AdminStaffEmailChangeBody,
  ): Promise<ServiceResult<{ pendingEmail: string }>> {
    return this.api.json<{ pendingEmail: string }>(
      `/admin/users/${encodeURIComponent(userId)}/email-change`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async cancelEmailChange(
    userId: string,
    body: AdminStaffEmailChangeCancelBody,
  ): Promise<ServiceResult<{ ok: true }>> {
    return this.api.json<{ ok: true }>(
      `/admin/users/${encodeURIComponent(userId)}/email-change/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async emailChangeKycRecord(
    userId: string,
  ): Promise<ServiceResult<AdminEmailChangeKycRecord | null>> {
    const result = await this.api.json<{ data: AdminEmailChangeKycRecord | null }>(
      `/admin/users/${encodeURIComponent(userId)}/email-change/kyc-record`,
    );
    return result.ok ? { ...result, data: result.data.data } : result;
  }

  async unsuspend(userId: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/users/${encodeURIComponent(userId)}/unsuspend`,
      { method: "POST" },
    );
  }
}

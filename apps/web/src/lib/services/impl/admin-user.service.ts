import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type {
  AdminPatchStaffRoleBody,
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

  async unsuspend(userId: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/users/${encodeURIComponent(userId)}/unsuspend`,
      { method: "POST" },
    );
  }
}

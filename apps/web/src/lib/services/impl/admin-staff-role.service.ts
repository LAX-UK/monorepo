import type { AdminAssignStaffRoleBody, AdminRemoveStaffRoleBody } from "@auction/validators";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { IAdminStaffRoleService } from "../interfaces/admin-staff-role-service";

const jsonHeaders = { "Content-Type": "application/json" };
const rolesPath = (userId: string) => `/admin/staff/${encodeURIComponent(userId)}/roles`;

export class AdminStaffRoleService implements IAdminStaffRoleService {
  constructor(private readonly api: IAuthedApiClient) {}

  assign(userId: string, body: AdminAssignStaffRoleBody) {
    return this.api.json<unknown>(rolesPath(userId), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  }

  remove(userId: string, body: AdminRemoveStaffRoleBody) {
    return this.api.json<unknown>(`${rolesPath(userId)}/remove`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  }
}

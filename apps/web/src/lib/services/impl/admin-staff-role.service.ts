import type { IAuthedApiClient } from "../http/authed-api-client";
import type { IAdminStaffRoleService } from "../interfaces/admin-staff-role-service";

const jsonHeaders = { "Content-Type": "application/json" };

/**
 * One admin's role changes on the staff record: `segment` names the admin's roles in the API
 * path (`roles` for Bid admin, `lax-admin-roles` for LAX Admin).
 */
export class AdminStaffRoleService<Assign, Remove>
  implements IAdminStaffRoleService<Assign, Remove>
{
  constructor(
    private readonly api: IAuthedApiClient,
    private readonly segment: "roles" | "lax-admin-roles" = "roles",
  ) {}

  private path(userId: string): string {
    return `/admin/staff/${encodeURIComponent(userId)}/${this.segment}`;
  }

  assign(userId: string, body: Assign) {
    return this.api.json<unknown>(this.path(userId), {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  }

  remove(userId: string, body: Remove) {
    return this.api.json<unknown>(`${this.path(userId)}/remove`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  }
}

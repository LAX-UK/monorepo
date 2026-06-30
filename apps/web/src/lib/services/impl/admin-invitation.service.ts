import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type {
  AdminCreateInvitationBody,
  IAdminInvitationService,
} from "../interfaces/admin-invitation-service";

export class AdminInvitationService implements IAdminInvitationService {
  constructor(private readonly api: IAuthedApiClient) {}

  private withFallback(
    result: ServiceResult<Record<string, unknown>>,
    fallback: string,
  ): ServiceResult<Record<string, unknown>> {
    if (!result.ok && result.message === "Request failed") {
      return { ...result, message: fallback };
    }
    return result;
  }

  async create(body: AdminCreateInvitationBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.withFallback(
      await this.api.json<Record<string, unknown>>("/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      "Could not create invite",
    );
  }

  async revoke(invitationId: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.withFallback(
      await this.api.json<Record<string, unknown>>(
        `/admin/invitations/${encodeURIComponent(invitationId)}/revoke`,
        { method: "POST" },
      ),
      "Could not revoke",
    );
  }

  async resend(invitationId: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.withFallback(
      await this.api.json<Record<string, unknown>>(
        `/admin/invitations/${encodeURIComponent(invitationId)}/resend`,
        { method: "POST" },
      ),
      "Could not resend",
    );
  }
}

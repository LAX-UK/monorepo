import type { RequestEmailChangeInput } from "@auction/validators";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type { IAccountService } from "../interfaces/account-service";

export class AccountService implements IAccountService {
  constructor(private readonly api: IAuthedApiClient) {}

  requestEmailChange(
    input: RequestEmailChangeInput,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  confirmEmailChange(input: { token: string }): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/auth/confirm-email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  cancelEmailChange(): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/auth/change-email", { method: "DELETE" });
  }

  requestAccountDeletion(input: {
    confirmation: "DELETE MY ACCOUNT";
  }): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/users/me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
}

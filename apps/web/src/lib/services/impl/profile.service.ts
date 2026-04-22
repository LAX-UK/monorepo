import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type {
  CreateAddressBody,
  IProfileService,
  UpdateProfileBody,
} from "../interfaces/profile-service";

export class ProfileService implements IProfileService {
  constructor(private readonly api: IAuthedApiClient) {}

  async updateProfile(body: UpdateProfileBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/users/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async createAddress(body: CreateAddressBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/users/me/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}
